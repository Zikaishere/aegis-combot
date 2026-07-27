import UserProfile from "./models/UserProfile.js";
import { extractFacts, stripPII, canExtract } from "./FactExtractor.js";
import { updateTopicCounts, getTopInterests } from "./InterestTracker.js";
import { isDuplicate } from "./stringUtils.js";

const EXTRACTION_INTERVAL = 15;
const MAX_FACTS = 25;

export async function getProfile(userId: string): Promise<{
  profile: string;
  facts: string[];
  interests: string[];
} | null> {
  try {
    const doc = await UserProfile.findOne({ userId }).lean();
    if (!doc) return null;
    const topicMap = doc.topicCounts instanceof Map
      ? doc.topicCounts
      : new Map(Object.entries(doc.topicCounts || {}));
    const interests = getTopInterests(topicMap, 10);
    return { profile: doc.profile || "", facts: doc.facts || [], interests };
  } catch {
    return null;
  }
}

export async function updateProfile(
  userId: string,
  userName: string,
  userMessage: string,
  history: { role: string; content: string }[],
): Promise<void> {
  try {
    let doc = await UserProfile.findOne({ userId });
    if (!doc) {
      doc = new UserProfile({ userId });
    }

    doc.messageCount = (doc.messageCount || 0) + 1;
    doc.topicCounts = updateTopicCounts(doc.topicCounts || new Map(), userMessage);

    const shouldExtract =
      doc.messageCount % EXTRACTION_INTERVAL === 0 &&
      userMessage.length >= 100 &&
      canExtract(userId);

    if (shouldExtract) {
      const result = await extractFacts(
        userName,
        stripPII(userMessage.slice(0, 500)),
        history,
        doc.profile,
        doc.facts,
      );

      if (result.profile) {
        doc.profile = result.profile;
      }

      if (result.obsoleteFactIndices.length > 0) {
        const toRemove = new Set(result.obsoleteFactIndices);
        doc.facts = doc.facts.filter((_, i) => !toRemove.has(i));
      }

      if (result.newFacts.length > 0) {
        for (const fact of result.newFacts) {
          if (!isDuplicate(fact, doc.facts)) {
            doc.facts.push(fact);
          }
        }

        if (doc.facts.length > MAX_FACTS) {
          doc.facts = doc.facts.slice(doc.facts.length - MAX_FACTS);
        }
      }

      doc.lastExtractedAt = new Date();
    }

    doc.interests = getTopInterests(doc.topicCounts, 10);
    await doc.save();
  } catch (error) {
    console.error("Profile update failed:", error);
  }
}

export async function resetProfile(userId: string): Promise<void> {
  await UserProfile.deleteOne({ userId });
}
