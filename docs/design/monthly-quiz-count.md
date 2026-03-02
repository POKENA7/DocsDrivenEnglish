# 設計書: 月別カレンダー表示を履歴ページに追加

## 概要

Issue #30 対応。  
履歴ページに「月別カレンダー」セクションを追加する。  
カレンダー上に学習した日をマークし、月ごとのナビゲーションと解いた問題数を表示する。

---

## 要件

- カレンダーを表示し、学習した日にマーク（ドット等）がつく
- カレンダーは前の月・次の月に移動できるナビゲーションボタンがある
- カレンダーと合わせて、表示中の月の解いた問題数が表示される

---

## 変更対象

| ファイル | 変更内容 |
|---|---|
| `src/server/history/query.ts` | 全期間の日ごとの問題数を取得するクエリ関数を追加 |
| `src/app/(features)/history/_components/StudyCalendar.tsx` | カレンダーUI（Client Component）を新規作成 |
| `src/app/(features)/history/_components/HistoryPage.tsx` | 全データをサーバーサイドで取得し StudyCalendar に渡す |
| `tests/unit/history-aggregate.test.ts` | 追加クエリのユニットテストを追加 |

---

## データ取得

### 新規関数: `getDailyAttemptCountsQuery`

全期間の日ごとの問題数を一括取得する（月指定なし）。

```typescript
type DailyAttemptCount = {
  year: number;
  month: number; // 1〜12
  day: number;   // 1〜31
  count: number;
};

export async function getDailyAttemptCountsQuery(userId: string): Promise<DailyAttemptCount[]>
```

**SQLロジック:**

```sql
SELECT
  CAST(strftime('%Y', answered_at / 1000, 'unixepoch') AS INTEGER) AS year,
  CAST(strftime('%m', answered_at / 1000, 'unixepoch') AS INTEGER) AS month,
  CAST(strftime('%d', answered_at / 1000, 'unixepoch') AS INTEGER) AS day,
  COUNT(*) AS count
FROM attempts
WHERE user_id = ?
GROUP BY year, month, day
ORDER BY year ASC, month ASC, day ASC
```

戻り値は学習した日のみ（0件の日は含まない）。

---

## データフロー

サーバーサイドで全データを一括取得し props で渡す。月の切り替えは Client Component 内の `useState` のみで完結する。追加フェッチ不要。

```
HistoryPage (Server Component)
  └─ getDailyAttemptCountsQuery() → DailyAttemptCount[] を全件取得
  └─ <StudyCalendar allCounts={dailyCounts} />

StudyCalendar (Client Component)
  └─ useState<Date>(今月) で表示月を管理
  └─ 表示月が変わるたびに allCounts をフィルタして表示
```

---

## HistoryPage.tsx の変更

既存の `getHistorySummaryQuery` と並列で `getDailyAttemptCountsQuery` を呼び出し、`StudyCalendar` に渡す。

```typescript
const [summary, dailyCounts] = await Promise.all([
  getHistorySummaryQuery(userId),
  getDailyAttemptCountsQuery(userId),
]);
```

---

## UI コンポーネント

### `StudyCalendar.tsx` (Client Component)

shadcn/ui の `Calendar` コンポーネント（react-day-picker ベース）を使用する。

**Props:**
```typescript
type Props = {
  allCounts: DailyAttemptCount[];
};
```

**状態:**
- `month: Date` — 表示中の月（初期値: `new Date()` = 今月）

**月ナビゲーション:**
- shadcn/ui Calendar の `month` prop に state を渡し、`onMonthChange` で `setMonth` する
- 次月への移動は当月より先に進めないよう `toMonth` prop で制限

**学習日のハイライト:**
- `allCounts` を表示月でフィルタし、学習した日を `Date[]` に変換
- `modifiers={{ studied: studiedDays }}` で学習日を指定
- `modifiersClassNames={{ studied: "..." }}` でスタイリング（下部にドット表示）
- ナビゲーションボタンは `Calendar` 内蔵のものをそのまま使用

**月間合計:**
- カレンダー下部に「この月の問題数: XX 問」と表示
- フィルタ後の counts を `reduce` で合算

---

## テスト

`tests/unit/history-aggregate.test.ts` に `getDailyAttemptCountsQuery` のユニットテストを追加。

| # | ケース | 期待値 |
|---|---|---|
| 1 | アンサーが存在しない場合 | 空配列 |
| 2 | 同日に複数回答がある場合 | `count` が合算される |
| 3 | 複数日にまたがる場合 | 日ごとに集計、year/month/day ASC順 |
| 4 | 複数月にまたがる場合 | 月ごとに正しく year・month・day が設定される |

---

## 非対応事項

- カレンダー上でのクリックによる詳細表示（スコープ外）
- 正答率など問題数以外の指標のカレンダー表示（スコープ外）
