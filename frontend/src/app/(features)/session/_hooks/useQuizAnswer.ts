import useSWRMutation from "swr/mutation";

import { submitQuizAnswerAction } from "../_api/actions";

export function useQuizAnswer() {
  const mutation = useSWRMutation(
    "quiz/answer",
    async (
      _key,
      {
        arg,
      }: {
        arg: {
          sessionId: string;
          questionId: string;
          selectedIndex: number;
        };
      },
    ) => {
      return submitQuizAnswerAction(arg);
    },
  );

  return {
    submit: mutation.trigger,
    isSubmitting: mutation.isMutating,
  };
}
