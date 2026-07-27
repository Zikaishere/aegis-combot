import type { Message } from "discord.js";

const MAX_LEN = 2000;

export async function sendChunkedReply(message: Message, text: string): Promise<void> {
  if (text.length <= MAX_LEN) {
    await message.reply(text);
    return;
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_LEN) {
      chunks.push(remaining);
      break;
    }

    let splitAt = remaining.lastIndexOf("\n", MAX_LEN);
    if (splitAt < MAX_LEN * 0.5) {
      splitAt = remaining.lastIndexOf(" ", MAX_LEN);
    }
    if (splitAt < MAX_LEN * 0.5) {
      splitAt = MAX_LEN;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trim();
  }

  await message.reply(chunks[0]);
  for (let i = 1; i < chunks.length; i++) {
    await (message.channel as any).send(chunks[i]);
  }
}
