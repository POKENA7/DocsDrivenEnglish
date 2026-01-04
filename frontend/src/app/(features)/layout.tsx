import type { ReactNode } from "react";

import ClerkProviderWrapper from "../ClerkProviderWrapper";

import AuthButton from "./_components/AuthButton";

export const dynamic = "force-dynamic";

export default function FeaturesLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProviderWrapper>
      <div>
        <div className="mx-auto flex max-w-2xl justify-end px-6 py-4">
          <AuthButton />
        </div>

        {children}
      </div>
    </ClerkProviderWrapper>
  );
}
