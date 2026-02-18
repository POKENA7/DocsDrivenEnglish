"use client";

import { useFormStatus } from "react-dom";

export default function ContinueButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending ? "開始中..." : "続行（次の5問）"}
    </button>
  );
}
