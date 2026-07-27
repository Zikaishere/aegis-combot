import { connectDB } from "./services/DatabaseService.js";
import { register } from "./abilities/AbilityRegistry.js";
import { calculatorAbility } from "./abilities/CalculatorAbility.js";
import { webSearchAbility } from "./abilities/WebSearchAbility.js";
import { engine } from "./personality/PersonalityEngine.js";

register(calculatorAbility);
register(webSearchAbility);

export async function startApp(): Promise<void> {
  await connectDB();
  await engine.initialize();

  const { client } = await import("./client/Client");

  const SystemPrompt = (await import("./models/SystemPrompt")).default;
  const doc = await SystemPrompt.findOne({ key: "additions" });
  if (doc && doc.additions.length > 0) {
    console.log(`Loaded ${doc.additions.length} system prompt addition(s)`);
  }

  await client.login(process.env.DISCORD_TOKEN!);
}
