export interface DnaTraits {
  formality: number;
  humorLevel: number;
  emojiFrequency: number;
  responseLength: number;
  slangUsage: number;
  pacing: number;
  punctuationStyle: number;
  toxicity: number;
}

export const DEFAULT_TRAITS: DnaTraits = {
  formality: 0.5,
  humorLevel: 0.5,
  emojiFrequency: 0.3,
  responseLength: 0.5,
  slangUsage: 0.4,
  pacing: 0.5,
  punctuationStyle: 0.5,
  toxicity: 0,
};

export const TRAIT_BOUNDS: { [K in keyof DnaTraits]: [number, number] } = {
  formality: [0, 1],
  humorLevel: [0, 1],
  emojiFrequency: [0, 1],
  responseLength: [0, 1],
  slangUsage: [0, 1],
  pacing: [0, 1],
  punctuationStyle: [0, 1],
  toxicity: [0, 1],
};

export const KNOWN_SLANG = new Set([
  "ngl", "fr", "js", "bro", "fam", "lit", "bet", "cap", "nocap",
  "sus", "based", "cringe", "slay", "rizz", "gyat", "bussin",
  "yeet", "goat", "w", "l", "ratio", "pog", "poggers", "oof",
  "mood", "vibe", "vibes", "chill", "hmu", "wyd", "idk", "idc",
  "tbh", "imo", "imho", "afk", "brb", "lol", "lmao", "lmfao",
  "wtf", "stfu", "tf", "bc", "cuz", "gonna", "wanna",
  "gotta", "kinda", "sorta", "dunno", "prolly", "def", "rn",
  "yk", "yall", "coulda", "woulda", "shoulda", "finna", "tryna",
  "asap", "bff", "dm", "ftw", "idgaf", "jk", "np", "nvm",
  "omw", "ppl", "srsly", "tho", "til", "ty", "u", "ur",
  "ya", "ye", "smh", "ikr", "irl", "ft", "aight", "ight",
  "ong", "deadass", "frfr", "lowkey", "highkey", "ate", "ate that",
]);

export const TOXIC_PATTERNS = [
  /\b(kill\s+(yourself|urself)|kys|kys)\b/i,
];

export const FORMAL_INDICATORS = [
  /\b(however|therefore|nevertheless|furthermore|consequently|specifically)\b/i,
  /\b(regarding|accordingly|subsequently|alternatively|hence|thus)\b/i,
  /\b(please|would\s+you|may\s+I|could\s+you|should\s+we)\b/i,
  /\b(I\s+would\s+suggest|I\s+recommend|it\s+is\s+advisable)\b/i,
  /[.;:]/g,
];

export const CASUAL_INDICATORS = [
  /\b(yeah|nah|yep|nope|bruh|dude|man)\b/i,
  /\b(cuz|bc|pls|plz|thx|ty)\b/i,
  /\b(ain't|gonna|wanna|gotta|kinda|sorta)\b/i,
  /(!){2,}/g,
  /(\.\.\.|…)/g,
];

export const JOKE_PATTERNS = [
  /\b(lol|lmao|lmfao|rofl|dead|ded)\b/i,
  /\b(lmaooo|lolol|ahaha|haha|hehe)\b/i,
  /\b(that's\s+what\s+she\s+said|sus|cap|no\s+cap)\b/i,
  /😂|🤣|😭|💀/g,
];

export const EMOJI_RANGE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu;
export const CUSTOM_EMOJI = /<a?:[\w]+:\d+>/g;

export const MIN_CONFIDENCE = 50;
export const MAX_LEARNING_RATE = 200;
export const UPDATE_INTERVAL = 5;

export const MAX_COMMON_EMOJIS = 20;
export const MAX_TOP_SLANG = 15;
export const MAX_COMMON_TOPICS = 15;

export const RESPONSE_LENGTH_SHORT = 50;
export const RESPONSE_LENGTH_LONG = 300;
