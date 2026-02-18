# 設計書: 弱点分析ダッシュボード

**作成日**: 2026-02-18  
**ステータス**: Draft

---

## 背景・課題

現行の履歴画面（`/history`）は「学習した問題数」「正答率」「継続学習日数」を集計表示するにとどまっており、**どの分野・モードが苦手か**を把握する手段がない。

ユーザーが自分の弱点を認識できないと、得意な分野ばかり繰り返したり、苦手なままのトピックを放置しがちになる。弱点の可視化は学習効率の大幅な向上につながる。

---

## 解決方針

履歴画面に「弱点分析」セクションを追加し、以下の情報を提供する。

1. **モード別正答率**: 単語モード vs 読解モードの正答率比較
2. **トピック別正答率**: 学習したトピックごとの正答率ランキング（得意 / 苦手の可視化）
3. **間違いの多い問題 TOP10**: 同じ問題で何度も間違えているものを一覧表示
4. **時系列正答率グラフ**: 週単位で正答率の推移を表示

---

## UI 設計

### 履歴画面（`/history`）の追加セクション

```
┌──────────────────────────────────────────┐
│ 弱点分析                                 │
│                                          │
│ ── モード別正答率 ──────────────────    │
│ 単語モード   ████████░░  78%            │
│ 読解モード   █████░░░░░  52%  ← 要改善 │
│                                          │
│ ── 苦手トピック TOP3 ────────────────   │
│ 1. Kubernetes   正答率 41%   (22問)      │
│ 2. CSS Grid     正答率 45%   (11問)      │
│ 3. TypeScript   正答率 48%   (34問)      │
│                                          │
│ ── 得意トピック TOP3 ────────────────   │
│ 1. Git          正答率 92%   (26問)      │
│ 2. React Hooks  正答率 85%   (40問)      │
│ 3. Docker       正答率 80%   (15問)      │
│                                          │
│ ── 間違いの多い問題 ─────────────────  │
│ "orchestration" (Kubernetes) 0/4 ←     │
│ "idempotent" (HTTP)          1/4        │
│ "memoize" (React)            1/3        │
│ [単語帳で復習する →]                   │
└──────────────────────────────────────────┘
```

- 各「苦手トピック」行から「このトピックで再学習」ボタンへ遷移可能
- 「間違いの多い問題」は直接「単語帳に追加」できる

### 時系列グラフ（別タブ or スクロール下部）

```
正答率の推移（週次）

100%│
 80%│    ╭─╮  ╭─
 60%│ ╭──╯  ╰─╯
 40%│─╯
    └─────────────▶
     1/26 2/2 2/9 2/16
```

シンプルな折れ線グラフ（`recharts` 等のライブラリを利用）で表示する。

---

## データ設計

既存の `attempts` テーブルから集計するため、**スキーマ追加は不要**。

### 既存スキーマの確認

```
study_sessions: id, userId, topic, mode, createdAt, completedAt
questions:      id, sessionId, prompt, choices, answer, explanation
attempts:       id, questionId, sessionId, userId, selectedIndex, isCorrect, answeredAt
```

集計クエリで必要な情報はすべて既存テーブルから取得できる。

---

## API 設計

### `GET /api/stats/analysis` — 弱点分析データ取得

ログインユーザー専用エンドポイント（未認証は 401）。

**クエリパラメータ**

```
?days=90   // 集計対象期間（デフォルト 90 日）
```

**レスポンス**

```typescript
{
  byMode: {
    word: { correct: number; total: number; rate: number };
    reading: { correct: number; total: number; rate: number };
  };
  byTopic: Array<{
    topic: string;
    correct: number;
    total: number;
    rate: number;           // 0.0 〜 1.0
  }>;                        // total 降順、最大 50 件
  weakTopics: Array<{        // rate が低い順 TOP5（total >= 5 件以上のみ）
    topic: string;
    correct: number;
    total: number;
    rate: number;
  }>;
  strongTopics: Array<{      // rate が高い順 TOP5（total >= 5 件以上のみ）
    topic: string;
    correct: number;
    total: number;
    rate: number;
  }>;
  frequentMistakes: Array<{  // isCorrect=false の多い問題（同 questionId で集計）
    questionId: string;
    topic: string;
    prompt: string;          // 問題文の先頭 100 文字
    totalAttempts: number;
    correctCount: number;
  }>;                        // totalAttempts 降順、TOP10
  weeklyRates: Array<{       // 週ごとの正答率（直近 12 週）
    weekStart: string;       // 'YYYY-MM-DD'
    correct: number;
    total: number;
    rate: number;
  }>;
}
```

---

## 集計クエリ設計（Drizzle ORM / SQLite）

### モード別正答率

```typescript
const byMode = await db
  .select({
    mode: studySessions.mode,
    correct: sql<number>`sum(case when ${attempts.isCorrect} then 1 else 0 end)`,
    total: sql<number>`count(*)`,
  })
  .from(attempts)
  .innerJoin(studySessions, eq(attempts.sessionId, studySessions.id))
  .where(
    and(
      eq(attempts.userId, userId),
      gte(attempts.answeredAt, since)
    )
  )
  .groupBy(studySessions.mode);
```

### トピック別正答率

```typescript
const byTopic = await db
  .select({
    topic: studySessions.topic,
    correct: sql<number>`sum(case when ${attempts.isCorrect} then 1 else 0 end)`,
    total: sql<number>`count(*)`,
  })
  .from(attempts)
  .innerJoin(studySessions, eq(attempts.sessionId, studySessions.id))
  .where(
    and(
      eq(attempts.userId, userId),
      gte(attempts.answeredAt, since)
    )
  )
  .groupBy(studySessions.topic)
  .orderBy(sql`count(*) desc`);
```

### 間違いの多い問題

```typescript
const frequentMistakes = await db
  .select({
    questionId: attempts.questionId,
    topic: studySessions.topic,
    prompt: questions.prompt,
    totalAttempts: sql<number>`count(*)`,
    correctCount: sql<number>`sum(case when ${attempts.isCorrect} then 1 else 0 end)`,
  })
  .from(attempts)
  .innerJoin(questions, eq(attempts.questionId, questions.id))
  .innerJoin(studySessions, eq(attempts.sessionId, studySessions.id))
  .where(
    and(
      eq(attempts.userId, userId),
      gte(attempts.answeredAt, since)
    )
  )
  .groupBy(attempts.questionId)
  .having(sql`count(*) >= 2`)
  .orderBy(sql`count(*) desc`)
  .limit(10);
```

---

## 影響を受けるファイル一覧

| ファイル | 変更種別 | 内容 |
|----------|----------|------|
| `src/app/api/[[...route]]/stats.ts` | 新規 or 変更 | `GET /api/stats/analysis` ハンドラ追加 |
| `src/app/api/[[...route]]/app.ts` | 変更 | `/api/stats/analysis` ルート追加 |
| `src/app/(features)/history/_components/HistoryPage.tsx` | 変更 | 弱点分析セクション追加 |
| `src/app/(features)/history/_components/WeaknessAnalysis.tsx` | 新規 | 弱点分析 UI コンポーネント |
| `src/app/(features)/history/_components/WeeklyRateChart.tsx` | 新規 | 週次正答率グラフコンポーネント |
| `src/app/(features)/history/_api/query.ts` | 変更 | `GET /api/stats/analysis` 呼び出し追加 |
| `src/app/(features)/history/_hooks/useWeaknessAnalysis.ts` | 新規 | SWR による分析データ取得フック |
| `package.json` | 変更 | `recharts` 追加（グラフ描画） |

---

## 非機能要件

| 項目 | 内容 |
|------|------|
| ログイン必須 | 分析データはログインユーザーのみ。未ログインは分析セクション非表示・ログイン誘導 |
| パフォーマンス | `attempts` が大量になると集計クエリが重くなる。当面は `days=90` のフィルタで対応。将来的に `user_stats` への集計キャッシュを検討 |
| データ最低件数 | トピック別は `total >= 5` 件以上のトピックのみ `weakTopics` / `strongTopics` に含める（データ不足による誤判定を防ぐ） |
| キャッシュ | SWR の `revalidateOnFocus: false`、`dedupingInterval: 60000`（1分）で頻繁なリクエストを抑制 |

---

## 未解決事項（TODO）

- [ ] グラフライブラリの選定（`recharts` vs `chart.js` vs CSS のみで実装）
- [ ] `GET /api/stats/analysis` の集計が遅い場合のキャッシュ戦略
- [ ] 「このトピックで再学習」ボタンの遷移先 UI 設計（`/learn` の入力欄にトピックを preset して開く）
- [ ] 分析データの集計期間 UI（30日 / 90日 / 全期間 の切り替え）
