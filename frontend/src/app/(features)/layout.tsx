import type { ReactNode } from "react";

import Link from "next/link";

import ClerkProviderWrapper from "../ClerkProviderWrapper";

import AuthButton from "./_components/AuthButton";

export const dynamic = "force-dynamic";

export default function FeaturesLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProviderWrapper>
      <div>
        <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur">
          <div className="container-page flex h-14 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm font-semibold tracking-tight">
                DocsDrivenEnglish
              </Link>
              <nav className="hidden items-center gap-2 sm:flex">
                <Link href="/learn" className="btn btn-ghost h-9 px-3">
                  学習
                </Link>
                <Link href="/history" className="btn btn-ghost h-9 px-3">
                  履歴
                </Link>
                <Link href="/review-queue" className="btn btn-ghost h-9 px-3">
                  復習
                </Link>
              </nav>
            </div>

            <AuthButton />
          </div>
        </header>

        {children}
      </div>
    </ClerkProviderWrapper>
  );
}
