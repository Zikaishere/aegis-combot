import type { GuildMember, ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } from "discord.js";
import VerificationConfig from "../models/VerificationConfig.js";
import { logModAction } from "../commands/mod/ModLogService.js";

const pendingCodes = new Map<string, { code: string; guildId: string; expiresAt: number }>();

const BUTTON_ID_VERIFY = "verify_enter_code";
const BUTTON_ID_RESEND = "verify_resend_code";
const MODAL_ID_VERIFY = "verify_modal";
const TEXT_INPUT_CODE = "verify_code_input";

function generateCode(length: number): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, value] of pendingCodes) {
    if (value.expiresAt < now) {
      pendingCodes.delete(key);
    }
  }
}

export function buildVerifyRow(): any {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_ID_VERIFY)
      .setLabel("Enter Code")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BUTTON_ID_RESEND)
      .setLabel("Resend Code")
      .setStyle(ButtonStyle.Secondary),
  );
}

export function buildVerifyEmbed(guildName: string, guildIcon?: string | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Welcome — Verification Required")
    .setDescription(
      `Welcome to **${guildName}**!\n\n` +
      "To access this server, you need to verify your account.\n\n" +
      "**How to verify:**\n" +
      "1. Check your DMs for a verification code\n" +
      "2. Click **Enter Code** below\n" +
      "3. Paste the code in the modal\n\n" +
      "Didn't receive a code? Click **Resend Code**.",
    )
    .setFooter({ text: "You must verify to access the server." })
    .setTimestamp();

  if (guildIcon) embed.setThumbnail(guildIcon);

  return embed;
}

export async function handleVerificationJoin(member: GuildMember): Promise<void> {
  if (member.user.bot) return;

  const config = await VerificationConfig.findOne({ guildId: member.guild.id });
  if (!config || !config.enabled) return;
  if (!config.gateChannelId || !config.verifiedRoleId) return;

  const accountAgeMs = Date.now() - member.user.createdAt.getTime();
  const minAgeMs = config.minAccountAgeDays * 24 * 60 * 60 * 1000;

  if (accountAgeMs >= minAgeMs) {
    await member.roles.add(config.verifiedRoleId).catch(() => {});
    return;
  }

  await sendVerificationDM(member, config);

  const gateChannel = await member.guild.channels.fetch(config.gateChannelId).catch(() => null);
  if (gateChannel && gateChannel.isTextBased() && !gateChannel.isVoiceBased()) {
    await (gateChannel as any).send({
      content: `<@${member.id}>`,
      embeds: [buildVerifyEmbed(member.guild.name, member.guild.iconURL())],
      components: [buildVerifyRow()],
    }).catch(() => {});
  }
}

async function sendVerificationDM(member: GuildMember, config: any): Promise<void> {
  const code = generateCode(config.codeLength);
  const expiresAt = Date.now() + config.codeExpiryMs;

  pendingCodes.set(`${member.guild.id}:${member.id}`, {
    code,
    guildId: member.guild.id,
    expiresAt,
  });

  const guildName = member.guild.name;
  const dmText = config.dmMessage
    .replaceAll("{server}", guildName)
    .replaceAll("{code}", `**${code}**`);

  try {
    await member.send(dmText);
  } catch {
    const gateChannel = await member.guild.channels.fetch(config.gateChannelId).catch(() => null);
    if (gateChannel && "send" in gateChannel) {
      await (gateChannel as any).send({
        content: `<@${member.id}>, I couldn't DM you. Please open your DMs and click **Resend Code**, or ask a staff member.`,
      }).catch(() => {});
    }
  }
}

export async function handleVerifyButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) return;

  const config = await VerificationConfig.findOne({ guildId: interaction.guild.id });
  if (!config || !config.enabled) {
    await interaction.reply({ content: "Verification is not active.", ephemeral: true });
    return;
  }

  if (interaction.channel?.id !== config.gateChannelId) return;

  cleanupExpired();

  if (interaction.customId === BUTTON_ID_RESEND) {
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: "Error finding your member record.", ephemeral: true });
      return;
    }

    pendingCodes.delete(`${interaction.guild.id}:${interaction.user.id}`);
    await sendVerificationDM(member, config);

    await interaction.reply({
      content: "A new code has been sent to your DMs. Click **Enter Code** when ready.",
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId === BUTTON_ID_VERIFY) {
    const pending = pendingCodes.get(`${interaction.guild.id}:${interaction.user.id}`);
    if (!pending) {
      await interaction.reply({
        content: "You don't have a pending verification code. Click **Resend Code** to get one.",
        ephemeral: true,
      });
      return;
    }

    if (pending.expiresAt < Date.now()) {
      pendingCodes.delete(`${interaction.guild.id}:${interaction.user.id}`);
      await interaction.reply({
        content: "Your code has expired. Click **Resend Code** to get a new one.",
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(MODAL_ID_VERIFY)
      .setTitle("Enter Verification Code")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(TEXT_INPUT_CODE)
            .setLabel("Verification code from your DMs")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("e.g. 482916")
            .setRequired(true)
            .setMinLength(4)
            .setMaxLength(10),
        ),
      );

    await interaction.showModal(modal);
  }
}

export async function handleVerifyModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (interaction.customId !== MODAL_ID_VERIFY) return false;
  if (!interaction.guild) return false;

  const config = await VerificationConfig.findOne({ guildId: interaction.guild.id });
  if (!config || !config.enabled) {
    await interaction.reply({ content: "Verification is not active.", ephemeral: true });
    return true;
  }

  cleanupExpired();

  const pending = pendingCodes.get(`${interaction.guild.id}:${interaction.user.id}`);
  if (!pending) {
    await interaction.reply({
      content: "You don't have a pending verification code. Click **Resend Code** in the verification channel.",
      ephemeral: true,
    });
    return true;
  }

  if (pending.expiresAt < Date.now()) {
    pendingCodes.delete(`${interaction.guild.id}:${interaction.user.id}`);
    await interaction.reply({
      content: "Your code has expired. Click **Resend Code** in the verification channel for a new one.",
      ephemeral: true,
    });
    return true;
  }

  const entered = interaction.fields.getTextInputValue(TEXT_INPUT_CODE).trim();

  if (entered === pending.code) {
    pendingCodes.delete(`${interaction.guild.id}:${interaction.user.id}`);

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: "Error: couldn't find your member record.", ephemeral: true });
      return true;
    }

    if (config.verifiedRoleId) {
      await member.roles.add(config.verifiedRoleId).catch(() => {});
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("Verified!")
      .setDescription(`Welcome to **${interaction.guild.name}**, ${member}! You now have access to the server.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    if (config.logChannelId) {
      const logChannel = await interaction.guild.channels.fetch(config.logChannelId).catch(() => null);
      if (logChannel && "send" in logChannel) {
        await (logChannel as any).send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle("User Verified")
              .addFields(
                { name: "User", value: `<@${member.id}>`, inline: true },
                { name: "Method", value: "Modal code", inline: true },
                { name: "Account Age", value: `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>`, inline: true },
              )
              .setTimestamp(),
          ],
        }).catch(() => {});
      }
    }

    return true;
  }

  const attempts = (interaction as any).__verifyAttempts || 0;
  (interaction as any).__verifyAttempts = attempts + 1;

  if (attempts >= 4) {
    pendingCodes.delete(`${interaction.guild.id}:${interaction.user.id}`);
    await interaction.reply({
      content: "Too many failed attempts. Click **Resend Code** for a new code or ask a staff member.",
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `Incorrect code. ${5 - attempts - 1} attempts remaining. Check your DMs.`,
      ephemeral: true,
    });
  }

  return true;
}

export async function handleGateChannelMessage(message: any): Promise<boolean> {
  if (message.author?.bot) return false;
  if (!message.guild) return false;

  const config = await VerificationConfig.findOne({ guildId: message.guild.id });
  if (!config || !config.enabled) return false;
  if (!config.gateChannelId) return false;
  if (message.channel?.id !== config.gateChannelId) return false;

  try {
    await message.delete();
  } catch {}

  return true;
}
