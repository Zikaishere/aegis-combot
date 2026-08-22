import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import { WORDLE_WORDS } from "../../games/wordle/words.js";
import { WordleGame, WordleStats } from "../../models/WordleGame.js";

const MAX_GUESSES = 6;

export class WordleCommand extends BaseCommand {
  name = "wordle";
  description = "Play Wordle — guess the 5-letter word in 6 tries";
  requiredPermissionLevel = PermissionLevel.None;

  slashCommand = new SlashCommandBuilder()
    .setName("wordle")
    .setDescription("Play Wordle")
    .addSubcommand(sub =>
      sub.setName("play").setDescription("Start a new Wordle game"),
    )
    .addSubcommand(sub =>
      sub
        .setName("guess")
        .setDescription("Guess a 5-letter word")
        .addStringOption(opt => opt.setName("word").setDescription("Your 5-letter guess").setRequired(true).setMinLength(5).setMaxLength(5)),
    )
    .addSubcommand(sub =>
      sub.setName("stats").setDescription("View your Wordle stats"),
    )
    .addSubcommand(sub =>
      sub.setName("leaderboard").setDescription("View the server Wordle leaderboard"),
    )
    .addSubcommand(sub =>
      sub.setName("hint").setDescription("Get a hint about the current word"),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    if (!ctx.guildId) return "Server only.";

    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    switch (subcommand) {
      case "play": return this.handlePlay(ctx);
      case "guess": return this.handleGuess(ctx);
      case "stats": return this.handleStats(ctx);
      case "leaderboard": return this.handleLeaderboard(ctx);
      case "hint": return this.handleHint(ctx);
      default: return this.unknownSubcommand(subcommand);
    }
  }

  private getDailyWord(): string {
    const today = new Date();
    const start = new Date(2024, 0, 1);
    const dayIndex = Math.floor((today.getTime() - start.getTime()) / 86400000);
    return WORDLE_WORDS[dayIndex % WORDLE_WORDS.length];
  }

  private renderGuess(guess: string, word: string): string {
    const result: string[] = [];
    const wordLetters = word.split("");
    const guessLetters = guess.split("");
    const used: boolean[] = new Array(5).fill(false);

    for (let i = 0; i < 5; i++) {
      if (guessLetters[i] === wordLetters[i]) {
        result.push("🟩");
        used[i] = true;
        guessLetters[i] = "*";
      } else {
        result.push("");
      }
    }

    for (let i = 0; i < 5; i++) {
      if (result[i] === "🟩") continue;
      let found = false;
      for (let j = 0; j < 5; j++) {
        if (!used[j] && guessLetters[i] === wordLetters[j]) {
          result[i] = "🟨";
          used[j] = true;
          found = true;
          break;
        }
      }
      if (!found) result[i] = "⬛";
    }

    return result.join("");
  }

  private async handlePlay(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const userId = ctx.userId;

    const existing = await WordleGame.findOne({ channelId: ctx.channelId, playerId: userId, active: true });
    if (existing) {
      return "You already have an active Wordle game! Use `/wordle guess word:XXXXX` to guess, or `/wordle stats` to see your attempts.";
    }

    const word = this.getDailyWord();

    const game = await WordleGame.create({
      guildId: ctx.guildId,
      channelId: ctx.channelId,
      word,
      guesses: [],
      playerId: userId,
      active: true,
    });

    const embed = new EmbedBuilder()
      .setColor(0x6aaa64)
      .setTitle("Wordle — Game Started!")
      .setDescription(
        "Guess the 5-letter word in 6 tries.\n\n" +
        "**How to play:**\n" +
        "🟩 = Correct letter, correct position\n" +
        "🟨 = Correct letter, wrong position\n" +
        "⬛ = Letter not in word\n\n" +
        "**Guesses:** 0/" + MAX_GUESSES + "\n" +
        "```\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n```",
      )
      .setFooter({ text: "Use /wordle guess word:XXXXX to guess" })
      .setTimestamp();

    return { embeds: [embed] };
  }

  private async handleGuess(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const guess = ctx.type === "slash"
      ? ctx.interaction?.options.getString("word", true)?.toLowerCase()
      : ctx.args[0]?.toLowerCase();

    if (!guess || guess.length !== 5) return "Provide a 5-letter word.";
    if (!/^[a-z]+$/.test(guess)) return "Only letters allowed.";

    const game = await WordleGame.findOne({ channelId: ctx.channelId, playerId: ctx.userId, active: true });
    if (!game) return "No active game. Start one with `/wordle play`.";

    const word = this.getDailyWord();

    const rendered = this.renderGuess(guess, word);
    game.guesses.push(rendered);

    let won = false;
    if (guess === word) {
      won = true;
      game.won = true;
    }

    if (game.guesses.length >= MAX_GUESSES || won) {
      game.active = false;
    }

    await game.save();

    const guessesBoard = game.guesses.join("\n");
    const emptyRows = Array(Math.max(0, MAX_GUESSES - game.guesses.length)).fill("⬜ ⬜ ⬜ ⬜ ⬜");
    const board = [guessesBoard, ...emptyRows].join("\n");

    if (won) {
      const stats = await this.updateStats(ctx.guildId!, ctx.userId, true);
      const embed = new EmbedBuilder()
        .setColor(0x6aaa64)
        .setTitle("Wordle — You Won!")
        .setDescription(
          "```\n" + board + "\n```\n\n" +
          "**" + game.guesses.length + "/" + MAX_GUESSES + "** attempts\n" +
          "🔥 Streak: " + stats.currentStreak,
        )
        .setFooter({ text: "Word: " + word.toUpperCase() })
        .setTimestamp();
      return { embeds: [embed] };
    }

    if (!game.active) {
      await this.updateStats(ctx.guildId!, ctx.userId, false);
      const embed = new EmbedBuilder()
        .setColor(0xff1744)
        .setTitle("Wordle — Game Over")
        .setDescription(
          "```\n" + board + "\n```\n\n" +
          "The word was: **" + word.toUpperCase() + "**",
        )
        .setTimestamp();
      return { embeds: [embed] };
    }

    const embed = new EmbedBuilder()
      .setColor(0x6aaa64)
      .setTitle("Wordle — Guess " + game.guesses.length + "/" + MAX_GUESSES)
      .setDescription("```\n" + board + "\n```")
      .setFooter({ text: "Use /wordle guess word:XXXXX to guess again" })
      .setTimestamp();

    return { embeds: [embed] };
  }

  private async updateStats(guildId: string, userId: string, won: boolean) {
    let stats = await WordleStats.findOne({ guildId, userId });
    if (!stats) {
      stats = await WordleStats.create({ guildId, userId });
    }

    stats.gamesPlayed++;
    if (won) {
      stats.gamesWon++;
      stats.currentStreak++;
      if (stats.currentStreak > stats.maxStreak) {
        stats.maxStreak = stats.currentStreak;
      }
      stats.lastWonAt = new Date();
    } else {
      stats.currentStreak = 0;
    }

    await stats.save();
    return stats;
  }

  private async handleStats(ctx: CommandContext): Promise<{ embeds: any[] }> {
    const stats = await WordleStats.findOne({ guildId: ctx.guildId, userId: ctx.userId });

    const played = stats?.gamesPlayed ?? 0;
    const won = stats?.gamesWon ?? 0;
    const winRate = played > 0 ? Math.round((won / played) * 100) : 0;

    const embed = new EmbedBuilder()
      .setColor(0x6aaa64)
      .setTitle("Your Wordle Stats")
      .addFields(
        { name: "Games Played", value: String(played), inline: true },
        { name: "Games Won", value: String(won), inline: true },
        { name: "Win Rate", value: winRate + "%", inline: true },
        { name: "Current Streak", value: String(stats?.currentStreak ?? 0), inline: true },
        { name: "Max Streak", value: String(stats?.maxStreak ?? 0), inline: true },
      )
      .setTimestamp();

    return { embeds: [embed] };
  }

  private async handleLeaderboard(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const stats = await WordleStats.find({ guildId: ctx.guildId })
      .sort({ gamesWon: -1, maxStreak: -1 })
      .limit(10);

    if (stats.length === 0) return "No games played yet.";

    const lines = stats.map((s, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1);
      return medal + " <@" + s.userId + "> — " + s.gamesWon + " wins, 🔥 " + s.maxStreak;
    });

    const embed = new EmbedBuilder()
      .setColor(0x6aaa64)
      .setTitle("Wordle Leaderboard")
      .setDescription(lines.join("\n"))
      .setTimestamp();

    return { embeds: [embed] };
  }

  private async handleHint(ctx: CommandContext): Promise<string> {
    const word = this.getDailyWord();
    const vowels = word.split("").filter(c => "aeiou".includes(c));
    const consonants = word.split("").filter(c => !"aeiou".includes(c));

    const hints = [
      "Starts with: **" + word[0].toUpperCase() + "**",
      "Ends with: **" + word[4].toUpperCase() + "**",
      "Contains " + vowels.length + " vowel(s)",
      "Contains " + consonants.length + " consonant(s)",
      "Second letter: **" + word[1].toUpperCase() + "**",
      "Middle letter: **" + word[2].toUpperCase() + "**",
    ];

    const hint = hints[Math.floor(Math.random() * hints.length)];
    return "💡 **Hint:** " + hint;
  }
}
