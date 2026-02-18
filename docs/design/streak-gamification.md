# 設計書: 学習ストリーク・ゲーミフィケーション

**作成日**: 2026-02-18  
**ステータス**: Draft

---

## 背景・課題

英語学習において最大の障壁は「継続」である。現状のアプリは学習結果の確認（正答率・学習問題数）はできるが、継続学習を促す仕組みが存在しない。

Duolingo などの実績が示す通り、ストリーク（連続学習日数）と XP（経験値）のゲーミフィケーションは学習の習慣化に強力に寄与する。

---

## 解決方針

以下の要素を追加する。

1. **ストリーク**: 連続学習日数をカウントし、ホーム画面・履歴画面に表示する
2. **XP（経験値）**: 正解ごとにXPを付与し、累計XPに応じてレベルを上げる
3. **学習カレンダー**: 月単位で学習した日をヒートマップ的に表示する

---

## UI 設計

### 履歴画面（`/history`）上部

```
┌──────────────────────────────────────────┐
│  🔥 ストリーク  14日                     │
│  ⭐ XP         2,340  Lv.8              │
│                                          │
│  [学習カレンダー 2026年2月]              │
│   月 火 水 木 金 土 日                   │
│   ●  ●  ●  ●  ●  ○  ●               │
│   ●  ●  ●  ●  ●  ●  ●               │
│   ●  ●  ○  ●  ○  今                  │
└──────────────────────────────────────────┘
```

- `●`: 学習した日、`○`: 学習しなかった日、`今`: 今日
- ストリークが途切れた日には「ストリーク終了」バッジを表示

### セッション完了画面（`/session/[id]/complete`）

```
┌──────────────────────────────────────────┐
│ セッション完了！                         │
│                                          │
│ 正答率: 4/5 (80%)                       │
│                                          │
│ + 40 XP 獲得  🔥 ストリーク 14日        │
│                                          │
│ [もう5問やる]  [別のトピックへ]         │
└──────────────────────────────────────────┘
```

- XP 獲得アニメーション（数値カウントアップ）
- レベルアップした場合は「🎉 Lv.9 に昇格！」バナーを表示

---

## XP・レベル設計

### XP 付与ルール

| アクション | 獲得XP |
|------------|--------|
| 1問正解 | 10 XP |
| セッション完了ボーナス（全問正解） | +20 XP |
| ストリーク継続ボーナス（当日初学習） | +5 XP |

### レベルテーブル

| レベル | 必要累計XP |
|--------|-----------|
| Lv.1 | 0 |
| Lv.2 | 100 |
| Lv.3 | 250 |
| Lv.4 | 500 |
| Lv.5 | 1,000 |
| Lv.6 | 2,000 |
| Lv.7 | 3,500 |
| Lv.8 | 5,500 |
| Lv.9 | 8,000 |
| Lv.10 | 12,000 |

レベル10以降は都度設計を追加する（MVP では Lv.10 上限で可）。

---

## ストリーク計算ロジック

### 定義

- 「学習した日」: UTC+9（JST）の日付で1問以上回答した `attempt` が存在する日
- 「連続」: 昨日も今日も学習した場合。2日以上のギャップで 0 にリセット
- ストリークは「今日学習済み」かどうかを含む（当日の学習で伸びる）

```typescript
// 例: attempts の日付（JST）を昇順に並べてストリーク計算
function calcStreak(attemptDates: Date[]): number {
  const jstDays = unique(attemptDates.map(toJstDateStr)).sort();
  let streak = 0;
  let prev = todayJst();
  for (const day of jstDays.reverse()) {
    if (diffDays(prev, day) <= 1) {
      streak++;
      prev = day;
    } else {
      break;
    }
  }
  return streak;
}
```

---

## データモデル

### `user_stats` テーブル（新規）

集計は毎回 `attempts` から計算すると重いため、ユーザーごとの集計値をキャッシュするテーブルを用意する。

```sql
CREATE TABLE user_stats (
  user_id         TEXT PRIMARY KEY,
  total_xp        INTEGER NOT NULL DEFAULT 0,
  current_streak  INTEGER NOT NULL DEFAULT 0,
  longest_streak  INTEGER NOT NULL DEFAULT 0,
  last_study_date TEXT,     -- 'YYYY-MM-DD' (JST)
  updated_at      INTEGER NOT NULL  -- Unix timestamp (ms)
);
```

### 更新タイミング

- `POST /api/quiz/sessions/:id/answers`（回答送信）の中でトランザクション内に `user_stats` を更新する
- ストリーク・XP の計算はサーバーサイドで実施し、クライアントには結果のみを返す

---

## API 設計

### `GET /api/stats` — ユーザー統計取得

**レスポンス**

```typescript
{
  totalXp: number;
  level: number;
  nextLevelXp: number;        // 次のレベルに必要な累計XP
  currentStreak: number;      // 現在の連続学習日数
  longestStreak: number;      // 過去最長ストリーク
  studiedToday: boolean;      // 今日すでに学習したか
  calendarDays: string[];     // 学習した日の配列 ('YYYY-MM-DD', 直近60日分)
}
```

### `POST /api/quiz/sessions/:id/answers` のレスポンス変更

回答送信後に XP 変化とストリーク情報を返す。

```typescript
// 追加フィールド
{
  // 既存フィールド ...
  xpGained: number;           // この回答で得た XP
  newTotalXp: number;         // 更新後の累計XP
  leveledUp: boolean;         // レベルアップしたか
  newLevel: number | null;    // レベルアップした場合の新レベル
  streakUpdated: boolean;     // ストリークが更新されたか
  currentStreak: number;      // 現在のストリーク日数
}
```

---

## 処理フロー

### 回答送信時の処理

```
1. answers INSERT（既存処理）
2. user_stats.total_xp += xpGained
3. last_study_date が今日でなければ:
   a. last_study_date が昨日 → current_streak + 1、studiedToday = true
   b. last_study_date が昨日以前 → current_streak = 1
   c. longest_streak = max(longest_streak, current_streak) に更新
4. last_study_date = today
5. updated_at = now()
6. COMMIT
```

---

## 影響を受けるファイル一覧

| ファイル | 変更種別 | 内容 |
|----------|----------|------|
| `src/db/schema.ts` | 変更 | `user_stats` テーブル追加 |
| `src/db/migrations/` | 追加 | Drizzle migration ファイル生成 |
| `src/app/api/[[...route]]/quiz.ts` | 変更 | 回答送信時の XP・ストリーク更新処理追加 |
| `src/app/api/[[...route]]/stats.ts` | 新規 | `GET /api/stats` ハンドラ |
| `src/app/api/[[...route]]/app.ts` | 変更 | `/api/stats` ルート追加 |
| `src/app/(features)/history/_components/HistoryPage.tsx` | 変更 | ストリーク・XP・カレンダー表示追加 |
| `src/app/(features)/session/_components/SessionCompletePage.tsx` | 変更 | XP獲得・ストリーク表示追加 |
| `src/app/(features)/history/_api/query.ts` | 変更 | `GET /api/stats` 呼び出し追加 |

---

## 非機能要件

| 項目 | 内容 |
|------|------|
| ログイン必須 | XP・ストリークはログインユーザーのみ永続化。未ログインはセッション内表示のみ |
| タイムゾーン | ストリーク日付判定は JST (UTC+9) で統一 |
| パフォーマンス | `user_stats` テーブルのキャッシュにより `attempts` 全件集計を回避 |
| 不正防止 | XP 付与はサーバーサイドのみで実施。クライアントから XP 直接操作は不可 |

---

## 未解決事項（TODO）

- [ ] ストリーク保護アイテム（streak freeze）を将来的に追加するか
- [ ] Lv.10 以降のレベルテーブル設計
- [ ] 週間・月間 XPランキング（ソーシャル要素）との連携設計
- [ ] 未ログインユーザーへの「ログインするとストリークが保存されます」誘導文言の設計
