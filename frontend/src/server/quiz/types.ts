import "server-only";

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

export type StartSessionResponse = {
  sessionId: string;
  plannedCount: number;
  actualCount: number;
  topic: string;
  questions: Array<{
    questionId: string;
    prompt: string;
    choices: Array<{ index: number; text: string }>;
  }>;
};

export type SubmitAnswerInput = {
  sessionId: string;
  questionId: string;
  selectedIndex: number;
};

export type SubmitAnswerResponse = {
  isCorrect: boolean;
  explanation: string;
  // 不正解時: 復習キューへの自動登録を通知 / 正解時(復習問題): 次回出題日時(ms)
  isReviewRegistered?: boolean;
  reviewNextAt?: number;
};
