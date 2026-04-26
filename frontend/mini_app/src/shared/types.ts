export type Profile = {
  v: 1;
};

export type BirthCodeAnalysisContext = {
  fullName: string;
  birthDate: string;
};

export type LearningSurvey = {
  level: "novice" | "experienced";
  goal: "self" | "answers" | "practice";
  format: "cards" | "numbers" | "both";
};

export type BirthCodeReport = {
  personalityType: string;
  keyEnergy: string;
  decisionPattern: string;
  strengths: string[];
  conflicts: string[];
  focusNow: string;
};

export type AppScreen = "daily" | "menu" | "cabinet" | "cabinetAuth" | "aiCoach" | "reviews";
export type DialogOrigin = "none" | "technique" | "cardDecode" | "cardDay" | "birthCode" | "review";

export type AiCoachEntryMode =
  | { kind: "default" }
  | { kind: "dialog" }
  | { kind: "review"; messages: { from: "user" | "ai"; text: string }[] };
