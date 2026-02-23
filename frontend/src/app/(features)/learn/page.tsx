import { auth } from "@clerk/nextjs/server";

import { getDueReviewCount } from "@/server/review/query";

import LearnPage from "./_components/LearnPage";

export default async function LearnIndexPage() {
  const { userId } = await auth();
  const dueCount = userId ? await getDueReviewCount(userId) : 0;
  return <LearnPage dueCount={dueCount} />;
}
