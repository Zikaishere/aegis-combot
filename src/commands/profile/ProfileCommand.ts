import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { getProfile } from "../../user-profiles/ProfileEngine.js";

export class ProfileCommand extends BaseCommand {
  name = "profile";
  description = "View your user profile";
  aliases = ["me"];

  slashCommand = new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View your user profile")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("User to look up").setRequired(false),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] } | null> {
    let targetId = ctx.userId;
    let tag = "You";

    if (ctx.type === "slash" && ctx.interaction) {
      const target = ctx.interaction.options.getUser("target");
      if (target) {
        targetId = target.id;
        tag = target.tag;
      }
    } else if (ctx.message?.mentions?.users) {
      const first = ctx.message.mentions.users.first();
      if (first) {
        targetId = first.id;
        tag = first.tag;
      }
    }

    const profile = await getProfile(targetId);
    if (!profile) return `${tag} dont have a profile yet — start chatting first`;

    const embed = new EmbedBuilder()
      .setColor(0x00b4d8)
      .setTitle(`${tag}'s Profile`)
      .setDescription(profile.profile || "No profile summary yet")
      .addFields(
        { name: "Facts", value: profile.facts.length ? profile.facts.map((f, i) => `${i + 1}. ${f}`).join("\n").slice(0, 1024) : "None yet", inline: false },
        { name: "Interests", value: profile.interests.length ? profile.interests.join(", ") : "Still forming", inline: false },
      );

    return { embeds: [embed] };
  }
}
