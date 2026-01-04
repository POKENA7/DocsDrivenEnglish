"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { SWRConfig } from "swr";

import { swrCommonConfig } from "@/lib/swr";

export default function ClerkProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <SWRConfig value={swrCommonConfig}>{children}</SWRConfig>
    </ClerkProvider>
  );
}
