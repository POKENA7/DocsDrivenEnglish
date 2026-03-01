import "server-only";

import { z } from "zod";

export const modeSchema = z.enum(["word", "reading"]);
export type Mode = z.infer<typeof modeSchema>;

export type ReviewQuestionRow = {
  questionId: string;
  prompt: string;
  choicesJson: string;
  correctIndex: number;
  explanation: string;
};

export type QuestionRecord = {
  questionId: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
};

export type SessionRecord = {
  sessionId: string;
  topic: string;
  mode: Mode;
  questions: QuestionRecord[];
};

export type StartSessionResponse = {
  sessionId: string;
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

export type MoreExplanationInput = {
  questionId: string;
  prompt: string;
  explanation: string;
};

export const moreExplanationResponseSchema = z.object({
  moreExplanation: z.string(),
});
export type MoreExplanationResponse = z.infer<typeof moreExplanationResponseSchema>;
