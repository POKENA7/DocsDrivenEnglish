"use client";

export default function QuizFormFields() {
  return (
    <fieldset className="mt-6">
      <legend className="text-sm font-medium">Mode</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="choice">
          <input className="mt-0.5" type="radio" name="mode" value="word" defaultChecked />
          <span>
            <span className="block font-medium">word</span>
            <span className="mt-1 block text-xs text-muted-foreground">単語・用語の理解を優先</span>
          </span>
        </label>
        <label className="choice">
          <input className="mt-0.5" type="radio" name="mode" value="reading" />
          <span>
            <span className="block font-medium">reading</span>
            <span className="mt-1 block text-xs text-muted-foreground">文脈・読解を優先</span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}
