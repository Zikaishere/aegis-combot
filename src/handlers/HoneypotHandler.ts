import type { Message, GuildMember } from "discord.js";
import { EmbedBuilder } from "discord.js";
import HoneypotConfig from "../models/HoneypotConfig.js";
import VerificationConfig from "../models/VerificationConfig.js";

export async function handleHoneypotMessage(message: Message): Promise<boolean> {
  if (message.author.bot) return false;
  if (!message.guild) return false;

  const config = await HoneypotConfig.findOne({ guildId: message.guild.id });
  if (!config || !config.enabled) return false;
  if (!config.trapChannels.includes(message.channel.id)) return false;

  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member) return false;

  if (member.roles.hoist?.id === member.guild.roles.everyone.id && member.roles.cache.size <= 1) {
    return false;
  }

  const roleNames = member.roles.cache
    .filter(r => r.id !== member.guild.roles.everyone.id)
    .map(r => r.name)
    .join(", ");

  const rolesToStrip = member.roles.cache
    .filter(r => r.id !== member.guild.roles.everyone.id)
    .map(r => r.id);

  if (rolesToStrip.length === 0) return false;

  await member.roles.remove(rolesToStrip, "Honeypot: triggered trap channel").catch(() => {});

  const verifyConfig = await VerificationConfig.findOne({ guildId: message.guild.id });
  if (verifyConfig?.enabled && verifyConfig.gateChannelId && verifyConfig.verifiedRoleId) {
    await member.roles.remove(verifyConfig.verifiedRoleId).catch(() => {});
  }

  try {
    await message.delete();
  } catch {}

  const logEmbed = new EmbedBuilder()
    .setColor(0xff1744)
    .setTitle("Honeypot Triggered")
    .addFields(
      { name: "User", value: `<@${member.id}> (${member.user.tag})`, inline: true },
      { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
      { name: "Roles Stripped", value: roleNames || "None", inline: false },
      { name: "Message", value: message.content.slice(0, 500) || "(no content)", inline: false },
    )
    .setFooter({ text: "Aegis — Honeypot System" })
    .setTimestamp();

  if (config.logChannelId) {
    const logChannel = await message.guild.channels.fetch(config.logChannelId).catch(() => null);
    if (logChannel && "send" in logChannel) {
      await (logChannel as any).send({ embeds: [logEmbed] }).catch(() => {});
    }
  }

  try {
    await member.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff1744)
          .setTitle("Roles Removed — Restricted Channel")
          .setDescription(
            `Your roles were stripped on **${message.guild.name}** because you sent a message in a restricted channel.\n\n` +
            `This is a security measure to protect against compromised accounts.\n\n` +
            `To regain access, you'll need to re-verify. Check the verification channel for instructions.`,
          )
          .setFooter({ text: "If you believe this is a mistake, contact a staff member." })
          .setTimestamp(),
      ],
    });
  } catch {}

  if (verifyConfig?.enabled && verifyConfig.gateChannelId) {
    const gateChannel = await message.guild.channels.fetch(verifyConfig.gateChannelId).catch(() => null);
    if (gateChannel && "send" in gateChannel) {
      await (gateChannel as any).send({
        content: `<@${member.id}>`,
        embeds: [
          new EmbedBuilder()
            .setColor(0xff9800)
            .setTitle("Re-Verification Required")
            .setDescription(
              `**${member.user.tag}** — your roles were removed because you sent a message in a restricted channel.\n\n` +
              `To regain access, click **Enter Code** below to submit the verification code sent to your DMs, or click **Resend Code** if you didn't receive one.`,
            )
            .addFields(
              { name: "What happened?", value: "You (or someone with access to your account) sent a message in a channel that is monitored for suspicious activity.", inline: false },
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ text: "Aegis — Honeypot System" })
            .setTimestamp(),
        ],
        components: [{
          type: 1,
          components: [
            { type: 2, custom_id: "verify_enter_code", label: "Enter Code", style: 1 },
            { type: 2, custom_id: "verify_resend_code", label: "Resend Code", style: 2 },
          ],
        }],
      }).catch(() => {});
    }
  }

  return true;
}
