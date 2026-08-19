import { EmbedBuilder } from "discord.js";
import type { Message } from "discord.js";
import { getAllCommands } from "../CommandBus.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";

export async function handleOwnerHelp(message: Message): Promise<void> {
  const commands = getAllCommands();

  const ownerCmds = [...commands.values()].filter(c => {
    const perm = c.requiredPermissionLevel ?? PermissionLevel.None;
    return perm === PermissionLevel.Owner || c.ownerOnly;
  });

  if (ownerCmds.length === 0) {
    await message.reply("No owner commands available.");
    return;
  }

  const lines = ownerCmds.map(c => {
    const sub: string[] = [];
    if (c.slashCommand) {
      const options = (c.slashCommand as any).options;
      if (options?.length) {
        for (const o of options) {
          if (o.type === 1) sub.push(o.name);
        }
      }
    }
    const subPreview = sub.length > 0 ? " → " + sub.join(", ") : "";
    return "`aegis " + c.name + "` — " + c.description + subPreview;
  });

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("Owner Commands")
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: "Aegis — Owner Panel" })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
