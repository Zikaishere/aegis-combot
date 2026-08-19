import { Client, GatewayIntentBits, Partials, EmbedBuilder } from "discord.js";
import { env } from "../config/index.js";
import * as telemetry from "../telemetry/recorder.js";

const LOG_CHANNEL = process.env.LOG_CHANNEL;

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

client.once("clientReady", async () => {
  console.log(`Aegis online as ${client.user?.tag}`);
  client.user?.setPresence({
    activities: [{ name: "Community AI Assistant | Aegis", type: 0 }],
    status: "online",
  });

  telemetry.setGuildCount(client.guilds.cache.size);

  setInterval(async () => {
    telemetry.setGuildCount(client.guilds.cache.size);
    await telemetry.snapshot();
    telemetry.reset();
  }, 3600000);

  const { registerSlashCommands } = await import("./events/Ready");
  await registerSlashCommands(client);

  const { handleMessage } = await import("./events/MessageCreate");
  const { handleInteraction } = await import("./events/InteractionCreate");

  client.on("messageCreate", handleMessage);
  client.on("interactionCreate", handleInteraction);

  const { handleGuildMemberAdd, handleGuildMemberRemove } = await import("../handlers/WelcomeHandler.js");
  const { handleVerificationJoin } = await import("../handlers/VerificationHandler.js");

  client.on("guildMemberAdd", async (member) => {
    await handleGuildMemberAdd(member as any);
    await handleVerificationJoin(member as any);
    const { checkRaid } = await import("../safety/RaidDetector.js");
    await checkRaid(member as any);
  });

  client.on("guildMemberRemove", async (member) => {
    handleGuildMemberRemove(member as any);
    const nuke = await import("../safety/NukeDetector.js");
    await nuke.onKickNuke(member as any);
  });

  const { handleReactionAdd, handleReactionRemove } = await import("../handlers/ReactionRoleHandler.js");
  client.on("messageReactionAdd", (reaction, user) => handleReactionAdd(reaction as any, user as any));
  client.on("messageReactionRemove", (reaction, user) => handleReactionRemove(reaction as any, user as any));

  const audit = await import("../handlers/AuditLogHandler.js");
  const nuke = await import("../safety/NukeDetector.js");
  client.on("channelCreate", (channel) => audit.onChannelCreate(channel));
  client.on("channelDelete", (channel) => { audit.onChannelDelete(channel); nuke.onChannelDeleteNuke(channel); });
  client.on("channelUpdate", (old, updated) => audit.onChannelUpdate(old, updated));
  client.on("roleCreate", (role) => audit.onRoleCreate(role));
  client.on("roleDelete", (role) => { audit.onRoleDelete(role); nuke.onRoleDeleteNuke(role); });
  client.on("roleUpdate", (old, updated) => audit.onRoleUpdate(old, updated));
  client.on("guildMemberUpdate", (old, updated) => audit.onMemberUpdate(old as any, updated));
  client.on("messageDelete", (message) => audit.onMessageDelete(message as any));
  client.on("messageUpdate", (old, updated) => audit.onMessageUpdate(old as any, updated as any));
  client.on("guildBanAdd", (ban) => { audit.onBanAdd(ban); nuke.onBanNuke(ban); });
  client.on("guildBanRemove", (ban) => audit.onBanRemove(ban));

  const { onVoiceStateUpdate } = await import("../handlers/TempVCHandler.js");
  client.on("voiceStateUpdate", (old, updated) => onVoiceStateUpdate(old, updated));
});

client.on("guildCreate", async (guild) => {
  telemetry.setGuildCount(client.guilds.cache.size);
  console.log(`Joined guild: ${guild.name} (${guild.id})`);

  if (!LOG_CHANNEL) return;

  const channel = await client.channels.fetch(LOG_CHANNEL).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0x00b4d8)
    .setTitle("Joined Server")
    .addFields(
      { name: "Server", value: guild.name, inline: true },
      { name: "ID", value: guild.id, inline: true },
      { name: "Members", value: `${guild.memberCount}`, inline: true },
    )
    .setTimestamp();
  (channel as any).send({ embeds: [embed] }).catch(() => {});
});

client.on("guildDelete", async (guild) => {
  telemetry.setGuildCount(client.guilds.cache.size);
  console.log(`Left guild: ${guild.name} (${guild.id})`);

  if (!LOG_CHANNEL) return;

  const channel = await client.channels.fetch(LOG_CHANNEL).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0xff1744)
    .setTitle("Left Server")
    .addFields(
      { name: "Server", value: guild.name, inline: true },
      { name: "ID", value: guild.id, inline: true },
    )
    .setTimestamp();
  (channel as any).send({ embeds: [embed] }).catch(() => {});
});
