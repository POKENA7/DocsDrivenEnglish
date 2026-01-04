import type { ReactNode } from "react";

import AuthButton from "./_components/AuthButton";

export default function FeaturesLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="mx-auto flex max-w-2xl justify-end px-6 py-4">
        <AuthButton />
      </div>

      {children}
    </div>
  );
}
