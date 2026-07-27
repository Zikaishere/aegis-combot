import { AttachmentBuilder } from "discord.js";
import type { Message, ChatInputCommandInteraction } from "discord.js";
import { env } from "../config/index.js";
import { render } from "./renderer.js";

const VALID_TYPES = ["summary", "activity", "commands", "latency", "growth", "errors"];

export async function handleStatsPrefix(message: Message, args: string[]) {
  if (message.author.id !== env.ownerId) return message.reply("nah");

  const type = (args[0] || "summary").toLowerCase();
  if (!VALID_TYPES.includes(type)) {
    return message.reply(`valid types: ${VALID_TYPES.join(", ")}`);
  }

  if (type !== "summary" && "sendTyping" in message.channel) {
    await (message.channel as any).sendTyping().catch(() => null);
  }

  try {
    const buffer = await render(type);
    if (!buffer) return message.reply("no data yet");
    const attachment = new AttachmentBuilder(buffer, { name: `stats-${type}.png` });
    return message.reply({ files: [attachment] });
  } catch (error) {
    console.error("Stats render failed:", error);
    return message.reply("failed to generate stats");
  }
}

export async function handleStatsSlash(interaction: ChatInputCommandInteraction) {
  if (interaction.user.id !== env.ownerId) {
    return interaction.reply({ content: "nah", ephemeral: true });
  }

  const type = interaction.options.getString("type") || "summary";
  if (!VALID_TYPES.includes(type)) {
    return interaction.reply({ content: `valid types: ${VALID_TYPES.join(", ")}`, ephemeral: true });
  }

  if (type !== "summary") await interaction.deferReply();

  try {
    const buffer = await render(type);
    if (!buffer) {
      if (interaction.deferred) await interaction.editReply("no data yet");
      else await interaction.reply("no data yet");
      return;
    }
    const attachment = new AttachmentBuilder(buffer, { name: `stats-${type}.png` });
    const reply = { files: [attachment] };
    if (interaction.deferred) {
      await interaction.editReply(reply);
    } else {
      await interaction.reply(reply);
    }
  } catch (error) {
    console.error("Stats render failed:", error);
    const msg = "failed to generate stats";
    if (interaction.deferred) await interaction.editReply(msg);
    else await interaction.reply({ content: msg, ephemeral: true });
  }
}

export { VALID_TYPES };
