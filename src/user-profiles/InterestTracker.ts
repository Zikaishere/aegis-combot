const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "no",
  "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "just", "because", "but", "and", "or", "if", "while", "this", "that",
  "these", "those", "it", "its", "my", "your", "his", "her", "our",
  "their", "me", "him", "us", "them", "i", "you", "he", "she", "we",
  "they", "im", "dont", "wont", "cant", "didnt", "doesnt", "wasnt",
  "isnt", "arent", "havent", "hasnt", "couldnt", "wouldnt", "shouldnt",
  "theres", "its", "thats", "whats", "whos", "where", "whys", "hows",
  "yeah", "nah", "okay", "ok", "hello", "hey", "hi", "lol", "lmao",
  "idk", "idc", "ikr", "ngl", "tbh", "btw", "omg", "wtf",
]);

const MIN_WORD_LENGTH = 3;

export function updateTopicCounts(
  current: Map<string, number>,
  message: string,
): Map<string, number> {
  const words = message
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(w));

  for (const word of words) {
    current.set(word, (current.get(word) || 0) + 1);
  }

  return current;
}

export function getTopInterests(
  topicCounts: Map<string, number>,
  count = 10,
): string[] {
  return [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word);
}
