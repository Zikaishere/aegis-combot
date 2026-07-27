export interface ChannelTemplate {
  name: string;
  type: "text" | "voice" | "forum" | "stage";
  topic?: string;
  nsfw?: boolean;
  permissionOverwrites?: PermissionOverwriteTemplate[];
}

export interface PermissionOverwriteTemplate {
  roleId?: string;
  deny?: bigint[];
  allow?: bigint[];
}

export interface RoleTemplate {
  name: string;
  color: string;
  permissions: bigint[];
  mentionable?: boolean;
}

export interface DivisionTemplate {
  name: string;
  description: string;
  channels: ChannelTemplate[];
  roles: RoleTemplate[];
  categoryPermissionOverwrites?: PermissionOverwriteTemplate[];
}

export const DIVISION_TEMPLATES: Record<string, DivisionTemplate> = {
  "research": {
    name: "Research Division",
    description: "Anomalous research, experimentation, and analysis.",
    channels: [
      { name: "briefing", type: "text", topic: "Mission briefings and research objectives" },
      { name: "reports", type: "text", topic: "Research findings and analysis reports" },
      { name: "archives", type: "text", topic: "Historical records and reference materials" },
      { name: "experiments", type: "forum", topic: "Ongoing experiments and documentation" },
      { name: "staff-only", type: "text", topic: "Internal staff discussion" },
    ],
    roles: [
      {
        name: "Research Lead",
        color: "#00b4d8",
        permissions: [],
      },
      {
        name: "Researcher",
        color: "#48cae4",
        permissions: [],
      },
    ],
  },
  "containment": {
    name: "Containment Wing",
    description: "Anomaly containment operations and breach response.",
    channels: [
      { name: "containment-logs", type: "text", topic: "Containment status updates and logs" },
      { name: "breach-alerts", type: "text", topic: "Active breach notifications" },
      { name: "procedures", type: "text", topic: "Containment protocols and procedures" },
      { name: "lockdown-channel", type: "text", topic: "Emergency lockdown communications" },
    ],
    roles: [
      {
        name: "Containment Specialist",
        color: "#ff6b6b",
        permissions: [],
      },
      {
        name: "Breach Response",
        color: "#ffa500",
        permissions: [],
      },
    ],
  },
  "medical": {
    name: "Medical Bay",
    description: "Medical operations and anomaly-related health research.",
    channels: [
      { name: "patient-records", type: "text", topic: "Patient intake and treatment records" },
      { name: "treatment-logs", type: "text", topic: "Ongoing treatment documentation" },
      { name: "quarantine", type: "text", topic: "Quarantine zone communications" },
      { name: "staff-only", type: "text", topic: "Medical staff internal discussion" },
    ],
    roles: [
      {
        name: "Medical Officer",
        color: "#2ecc71",
        permissions: [],
      },
    ],
  },
  "intelligence": {
    name: "Intelligence HQ",
    description: "Classified intelligence gathering and analysis.",
    channels: [
      { name: "classified", type: "text", topic: "Top secret intelligence briefings" },
      { name: "field-reports", type: "text", topic: "Incoming field agent reports" },
      { name: "surveillance", type: "text", topic: "Surveillance operation logs" },
      { name: "analyst-desk", type: "text", topic: "Analyst discussion and collaboration" },
    ],
    roles: [
      {
        name: "Intelligence Officer",
        color: "#9b59b6",
        permissions: [],
      },
      {
        name: "Field Agent",
        color: "#3498db",
        permissions: [],
      },
    ],
  },
  "operations": {
    name: "Operations Center",
    description: "Mission coordination and tactical operations.",
    channels: [
      { name: "mission-control", type: "text", topic: "Active mission coordination" },
      { name: "dispatch", type: "text", topic: "Team dispatch and deployment" },
      { name: "tactical-map", type: "text", topic: "Tactical situation updates" },
      { name: "debrief", type: "text", topic: "Post-mission debriefing" },
    ],
    roles: [
      {
        name: "Operations Commander",
        color: "#e74c3c",
        permissions: [],
      },
      {
        name: "Operative",
        color: "#95a5a6",
        permissions: [],
      },
    ],
  },
  "recon": {
    name: "Recon Division",
    description: "Field reconnaissance and anomaly detection.",
    channels: [
      { name: "field-ops", type: "text", topic: "Active field operations" },
      { name: "sighting-reports", type: "text", topic: "Anomaly sighting reports" },
      { name: "anomaly-tracker", type: "text", topic: "Anomaly movement and behavior tracking" },
      { name: "safehouse", type: "text", topic: "Secure communications" },
    ],
    roles: [
      {
        name: "Recon Specialist",
        color: "#1abc9c",
        permissions: [],
      },
    ],
  },
  "security": {
    name: "Security Wing",
    description: "Facility security and threat response.",
    channels: [
      { name: "incident-reports", type: "text", topic: "Security incident documentation" },
      { name: "patrol-logs", type: "text", topic: "Patrol schedule and logs" },
      { name: "threat-assessment", type: "text", topic: "Threat level monitoring" },
      { name: "armory", type: "text", topic: "Equipment and armory management" },
    ],
    roles: [
      {
        name: "Security Chief",
        color: "#2c3e50",
        permissions: [],
      },
      {
        name: "Security Officer",
        color: "#7f8c8d",
        permissions: [],
      },
    ],
  },
  "archives": {
    name: "Archives",
    description: "Historical records and timeline documentation.",
    channels: [
      { name: "timeline-records", type: "text", topic: "Timeline event documentation" },
      { name: "historical-docs", type: "text", topic: "Historical document archive" },
      { name: "redacted-files", type: "text", topic: "Classified redacted documents" },
      { name: "index", type: "text", topic: "Archive index and cross-references" },
    ],
    roles: [
      {
        name: "Archivist",
        color: "#8e44ad",
        permissions: [],
      },
    ],
  },
};

export function getTemplate(name: string): DivisionTemplate | undefined {
  const lower = name.toLowerCase();
  return DIVISION_TEMPLATES[lower];
}

export function listTemplates(): string[] {
  return Object.keys(DIVISION_TEMPLATES);
}
