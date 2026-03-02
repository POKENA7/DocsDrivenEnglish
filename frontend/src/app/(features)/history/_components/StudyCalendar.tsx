"use client";

import { useState } from "react";

import { Calendar } from "@/components/ui/calendar";
import type { DailyAttemptCount } from "@/server/history/query";

type Props = {
  allCounts: DailyAttemptCount[];
};

export default function StudyCalendar({ allCounts }: Props) {
  const [month, setMonth] = useState<Date>(new Date());

  const currentYear = month.getFullYear();
  const currentMonth = month.getMonth() + 1;

  const thisMonthCounts = allCounts.filter(
    (d) => d.year === currentYear && d.month === currentMonth,
  );

  const studiedDays = thisMonthCounts.map((d) => new Date(currentYear, currentMonth - 1, d.day));

  const monthTotal = thisMonthCounts.reduce((sum, d) => sum + d.count, 0);

  const today = new Date();

  return (
    <div className="card-compact reveal" style={{ animationDelay: "260ms" }}>
      <p className="text-xs text-muted-foreground">月別カレンダー</p>
      <div className="mt-3 flex flex-col items-start gap-3">
        <Calendar
          month={month}
          onMonthChange={setMonth}
          toMonth={today}
          modifiers={{ studied: studiedDays }}
          modifiersClassNames={{
            studied:
              "after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary relative",
          }}
          className="p-0"
        />
        <p className="text-sm text-muted-foreground">
          この月の問題数: <span className="font-semibold text-foreground">{monthTotal}</span> 問
        </p>
      </div>
    </div>
  );
}
