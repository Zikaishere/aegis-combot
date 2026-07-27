import { Client, GatewayIntentBits, Partials, EmbedBuilder } from "discord.js";
import { env } from "../config/index.js";
import * as telemetry from "../telemetry/recorder.js";

const LOG_CHANNEL = process.env.LOG_CHANNEL;

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once("ready", async () => {
  console.log(`Blaze online as ${client.user?.tag}`);
  client.user?.setPresence({
    activities: [{ name: "Behavioral Logic & Anomaly Zone Engine | Monitoring reality", type: 0 }],
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
});

client.on("guildCreate", async (guild) => {
  telemetry.setGuildCount(client.guilds.cache.size);
  console.log(`Joined guild: ${guild.name} (${guild.id})`);

  if (!LOG_CHANNEL) return;

  const channel = await client.channels.fetch(LOG_CHANNEL).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0x00b4d8)
    .setTitle("New Facility Registered")
    .addFields(
      { name: "Designation", value: guild.name, inline: true },
      { name: "Facility ID", value: guild.id, inline: true },
      { name: "Personnel", value: `${guild.memberCount}`, inline: true },
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
    .setTitle("Facility Deregisitered")
    .addFields(
      { name: "Designation", value: guild.name, inline: true },
      { name: "Facility ID", value: guild.id, inline: true },
    )
    .setTimestamp();
  (channel as any).send({ embeds: [embed] }).catch(() => {});
});
