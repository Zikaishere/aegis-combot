import type { PersonalityLayer } from "../../types/personality.js";
import { getTemplate, applyTemplate } from "../templates.js";

export function getUserProfileLayer(params: {
  userName: string;
  userProfile?: string;
  facts?: string[];
  interests?: string[];
  customFacts?: string[];
  memoryEnabled: boolean;
}): PersonalityLayer | null {
  const { userName, userProfile, facts, interests, customFacts, memoryEnabled } = params;

  if (!memoryEnabled) return null;

  const hasData = userProfile || (facts && facts.length > 0) || (interests && interests.length > 0) || (customFacts && customFacts.length > 0);
  if (!hasData) return null;

  const profile = userProfile || "Still learning about this user.";
  const factList = facts && facts.length > 0 ? facts.map((f) => `- ${f}`).join("\n") : "None yet.";
  const interestList = interests && interests.length > 0 ? interests.join(", ") : "Still forming.";
  const customFactList = customFacts && customFacts.length > 0 ? customFacts.map((f) => `- ${f}`).join("\n") : "None yet.";

  const template = getTemplate("user-profile");
  const content = template
    ? applyTemplate(template, {
        USER_NAME: userName,
        PROFILE_SUMMARY: profile,
        FACTS: factList,
        INTERESTS: interestList,
        CUSTOM_FACTS: customFactList,
      })
    : `User profile for ${userName}:\n${profile}`;

  return {
    name: "user-profile",
    priority: 40,
    tokens: Math.ceil(content.length / 4),
    content,
  };
}
