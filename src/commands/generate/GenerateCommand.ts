import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import { getProvider } from "../../ai/factory.js";
import { env } from "../../config/index.js";

type DocumentType = "anomaly_report" | "classified_file" | "terminal_log" | "mission_briefing" | "event_announcement" | "incident_report";

const DOCUMENT_PROMPTS: Record<DocumentType, string> = {
  anomaly_report: `Generate an anomaly report for Project Veil. Format:
ANOMALY DESIGNATION: [ designation ]
THREAT LEVEL: [ Threat-1 through Threat-5 ]
STATUS: [ contained / active / under_investigation ]
DISCOVERY DATE: [ date ]
LOCATION: [ location ]

DESCRIPTION:
[ detailed description of the anomaly ]

CONTAINMENT PROCURES:
[ how to contain or interact with it ]

ASSIGNED TEAM: [ team designation ]
NOTES: [ additional observations ]

Write as an official Project Veil document. Be specific and clinical.`,

  classified_file: `Generate a classified Project Veil document. Format:
CLASSIFICATION: [ CONFIDENTIAL / TOP SECRET / EYES ONLY ]
DOCUMENT ID: [ random alphanumeric ]
DATE: [ date ]
CLEARANCE REQUIRED: [ level ]

SUBJECT: [ topic ]

CONTENT:
[ classified content with some redacted sections marked as [REDACTED] ]

DISTRIBUTION: [ who receives this ]
AUTHORIZED BY: [ name and title ]

Write as a realistic intelligence document. Include redactions.`,

  terminal_log: `Generate terminal log entries for a Project Veil facility. Format multiple timestamped entries:
[YYYY-MM-DD HH:MM:SS] [SYSTEM] [message]
[YYYY-MM-DD HH:MM:SS] [USER: name] [message]
[YYYY-MM-DD HH:MM:SS] [ALERT] [message]

Include routine operations, then build to something unusual or alarming. Write 8-12 entries.`,

  mission_briefing: `Generate a mission briefing for Project Veil operatives. Format:
MISSION: [ designation ]
CLASSIFICATION: [ level ]
DATE: [ date ]
ASSIGNED TO: [ team/operative ]

OBJECTIVE:
[ primary objective ]

BACKGROUND:
[ context and intelligence ]

THREAT ASSESSMENT:
[ known risks ]

EQUIPMENT REQUIRED:
[ gear list ]

CONTINGENCIES:
[ backup plans ]

Write as a military-style briefing document.`,

  event_announcement: `Generate an event announcement for the Project Veil server. Write in-universe as an official broadcast from Project Veil command. Include:
- Urgency level
- What happened
- What operatives need to know
- Any immediate actions required

Write as a compelling in-universe announcement.`,

  incident_report: `Generate an incident report for Project Veil. Format:
INCIDENT ID: [ alphanumeric ]
DATE: [ date ]
REPORTED BY: [ name ]
LOCATION: [ location ]
SEVERITY: [ low / medium / high / critical ]

DESCRIPTION:
[ what happened ]

WITNESSES: [ names ]
ACTIONS TAKEN: [ response ]
CURRENT STATUS: [ resolution or ongoing ]
FOLLOW-UP REQUIRED: [ yes/no and details ]

Write as a formal incident report.`,
};

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  anomaly_report: "Anomaly Report",
  classified_file: "Classified File",
  terminal_log: "Terminal Log",
  mission_briefing: "Mission Briefing",
  event_announcement: "Event Announcement",
  incident_report: "Incident Report",
};

export class GenerateCommand extends BaseCommand {
  name = "generate";
  description = "Generate in-universe Project Veil documents";
  requiredPermissionLevel = PermissionLevel.Administrator;

  slashCommand = new SlashCommandBuilder()
    .setName("generate")
    .setDescription("Generate in-universe Project Veil documents")
    .addSubcommand(sub =>
      sub
        .setName("document")
        .setDescription("Generate a document")
        .addStringOption(opt =>
          opt.setName("type").setDescription("Document type").setRequired(true)
            .addChoices(
              ...Object.entries(DOC_TYPE_LABELS).map(([k, v]) => ({ name: v, value: k })),
            ),
        )
        .addStringOption(opt =>
          opt.setName("details").setDescription("Additional details or context for the document"),
        ),
    )
    .addSubcommand(sub =>
      sub.setName("types").setDescription("List all available document types"),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided.";

    if (subcommand === "types") {
      const lines = Object.entries(DOC_TYPE_LABELS).map(
        ([k, v]) => `\`${k}\` — ${v}`,
      );
      return {
        embeds: [
          new EmbedBuilder()
            .setColor(0x00b4d8)
            .setTitle("Available Document Types")
            .setDescription(lines.join("\n"))
            .setTimestamp(),
        ],
      };
    }

    if (subcommand === "document") {
      return this.handleDocument(ctx);
    }

    return "Unknown subcommand.";
  }

  private async handleDocument(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const docType = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("type", true) ?? undefined)
      : ctx.args[1];

    const details = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("details") ?? undefined)
      : ctx.args.slice(2).join(" ") || undefined;

    if (!docType) return "Usage: `generate document <type> [details]`";

    const basePrompt = DOCUMENT_PROMPTS[docType as DocumentType];
    if (!basePrompt) return `Unknown document type: \`${docType}\`. Use \`generate types\` to see available types.`;

    const userPrompt = details
      ? `${basePrompt}\n\nAdditional context: ${details}`
      : basePrompt;

    try {
      const provider = getProvider();
      const response = await provider.generateChat({
        systemPrompt: "You are Blaze, Behavioral Logic & Anomaly Zone Engine of Project Veil. Generate authentic in-universe documents. Write in a clinical, professional tone appropriate to intelligence documents. Never break character.",
        messages: [{ role: "user", content: userPrompt }],
        model: env.defaultModel,
        maxTokens: 1500,
        temperature: 0.8,
      });

      const typeLabel = DOC_TYPE_LABELS[docType as DocumentType] || docType;

      return {
        embeds: [
          new EmbedBuilder()
            .setColor(docType === "classified_file" ? 0xff1744 : 0x00b4d8)
            .setTitle(`${typeLabel} — Generated`)
            .setDescription(response.content.slice(0, 4000))
            .setFooter({ text: "Generated by Blaze — Behavioral Logic & Anomaly Zone Engine" })
            .setTimestamp(),
        ],
      };
    } catch (error) {
      return `Document generation failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
