import type { MessageReaction, User } from "discord.js";
import ReactionRole from "../models/ReactionRole.js";

export async function handleReactionAdd(reaction: MessageReaction, user: User): Promise<void> {
  if (user.bot) return;
  if (!reaction.message.guild) return;

  const rr = await ReactionRole.findOne({ guildId: reaction.message.guild.id, messageId: reaction.message.id });
  if (!rr) return;

  const emoji = reaction.emoji.name || reaction.emoji.id;
  const roleConfig = rr.roles.find(r => r.emoji === emoji);
  if (!roleConfig) return;

  const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  if (rr.type === "unique") {
    for (const r of rr.roles) {
      if (r.roleId !== roleConfig.roleId) {
        await member.roles.remove(r.roleId).catch(() => {});
      }
    }
  }

  await member.roles.add(roleConfig.roleId).catch(() => {});
}

export async function handleReactionRemove(reaction: MessageReaction, user: User): Promise<void> {
  if (user.bot) return;
  if (!reaction.message.guild) return;

  const rr = await ReactionRole.findOne({ guildId: reaction.message.guild.id, messageId: reaction.message.id });
  if (!rr) return;

  const emoji = reaction.emoji.name || reaction.emoji.id;
  const roleConfig = rr.roles.find(r => r.emoji === emoji);
  if (!roleConfig) return;

  if (rr.type === "unique") return;

  const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  await member.roles.remove(roleConfig.roleId).catch(() => {});
}
