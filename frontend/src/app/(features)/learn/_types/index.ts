export type Mode = "word" | "reading";

export type QuestionRecord = {
  questionId: string;
  sessionId: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  // 復習問題の複製元 questionId（通常問題は undefined）
  sourceQuestionId?: string;
};

export type SessionRecord = {
  sessionId: string;
  topic: string;
  mode: Mode;
  plannedCount: number;
  actualCount: number;
  questions: QuestionRecord[];
};
