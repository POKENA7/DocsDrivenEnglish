import { useState } from "react";

import { submitQuizAnswerAction } from "../_api/actions";

export function useQuizAnswer() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(arg: { sessionId: string; questionId: string; selectedIndex: number }) {
    setIsSubmitting(true);
    try {
      return await submitQuizAnswerAction(arg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return { submit, isSubmitting };
}
