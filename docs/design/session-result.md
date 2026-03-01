# 設計書: セッション完了リザルト画面

**作成日**: 2026-03-01  
**ステータス**: 設計中  
**Issue**: [#39 セッション完了後にリザルト画面を出す](https://github.com/POKENA7/DocsDrivenEnglish/issues/39)

---

## 背景・課題

現在のセッション完了画面（`/learn/[sessionId]/complete`）は「セッション完了」という見出しと続行ボタンのみを表示している。  
セッション中に何問正解できたか・どの問題を間違えたかをユーザーが確認できず、学習成果を振り返る手段がない。

---

## 解決方針

セッション完了後、DB に保存済みの `attempts` データを取得し、リザルト画面として正答数・正答率・問題ごとの正誤を表示する。  
クライアント側でのデータ保持は行わず、サーバー側で `sessionId` を元に `attempts` を取得する。

---

## UI 設計

### セッション完了画面（`/learn/[sessionId]/complete`）

```
┌──────────────────────────────────────────┐
│ セッション完了 🎉                         │
│ React Hooks — word モード                 │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │  正答数      8 / 10                  │ │
│ │  正答率      80%                     │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ─── 問題ごとの結果 ───────────────────── │
│                                          │
│ ✅ Q1  "lifecycle" とは何を指すか？      │
│ ✅ Q2  "immutable" の意味として ...      │
│ ❌ Q3  "reconciliation" とは...          │
│    正解: A. 仮想 DOM の差分検出プロセス  │
│ ...                                      │
│                                          │
│ [同じトピックで続ける]  [別のトピックへ] │
└──────────────────────────────────────────┘
```

#### 表示項目

| 項目 | 内容 |
|------|------|
| トピック名・モード | セッションのトピックとモードをサブタイトルとして表示 |
| 正答数 | `正解数 / 総問題数` 形式 |
| 正答率 | `(正解数 / 総問題数) × 100` を整数で表示 |
| 問題ごとの結果 | 問題文（先頭 50 文字）と正誤アイコン（✅ / ❌）を一覧表示 |
| 不正解問題の正解 | 不正解問題のみ正解の選択肢テキストをサブテキストで表示 |

- 問題ごとの結果は折りたたみ（accordion）は行わず、シンプルにリスト表示する
- 問題文が長い場合は末尾を省略（CSS `line-clamp-2`）

---

## データ設計

### サーバーサイドクエリ追加

`src/server/quiz/query.ts` に `getSessionResult` 関数を追加する。

```typescript
export type SessionResult = {
  topic: string;
  mode: "word" | "reading";
  totalCount: number;
  correctCount: number;
  items: Array<{
    questionId: string;
    prompt: string;
    correctIndex: number;
    choices: string[];
    isCorrect: boolean;
  }>;
};
```

**取得ロジック**

1. `sessions` テーブルから `sessionId` で `topic`・`mode`・`questionIdsJson` を取得
2. `questions` テーブルから `questionIdsJson` に含まれる問題を全件取得
3. `attempts` テーブルから `sessionId` に対応するレコードを全件取得
4. `questionIdsJson` の順序を保持しながら各問題と attempt を結合し `items` を生成

> `attempts` には 1 問につき最大 1 レコード（回答確定後に保存）が存在する前提。  
> attempt が存在しない問題（未回答）は `isCorrect: false` として扱う。

---

## コンポーネント設計

### `SessionCompletePage` の変更

**変更前**: `topic`・`mode` のみを受け取り「セッション完了」文言と続行ボタンを表示  
**変更後**: `SessionResult` 型を受け取り、スコアサマリと問題ごとの結果を表示

```typescript
// src/app/(features)/learn/_components/SessionCompletePage.tsx
export default function SessionCompletePage(props: { result: SessionResult; sessionId: string }) {
  const { result, sessionId } = props;
  const percentage = Math.round((result.correctCount / result.totalCount) * 100);

  return (
    <main className="container-page page">
      {/* ヘッダー */}
      <div className="reveal">
        <h1 className="heading-1">セッション完了 🎉</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.topic} — {result.mode} モード
        </p>
      </div>

      {/* スコアサマリ */}
      <section className="mt-6 card reveal" style={{ animationDelay: "80ms" }}>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-muted-foreground">正答数</dt>
            <dd className="mt-1 text-2xl font-bold">
              {result.correctCount} / {result.totalCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">正答率</dt>
            <dd className="mt-1 text-2xl font-bold">{percentage}%</dd>
          </div>
        </dl>
      </section>

      {/* 問題ごとの結果 */}
      <section className="mt-4 space-y-2 reveal" style={{ animationDelay: "160ms" }}>
        <h2 className="text-sm font-semibold text-muted-foreground">問題ごとの結果</h2>
        {result.items.map((item, i) => (
          <div key={item.questionId} className="card">
            <div className="flex items-start gap-3">
              <span>{item.isCorrect ? "✅" : "❌"}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium line-clamp-2">
                  Q{i + 1}. {item.prompt}
                </p>
                {!item.isCorrect && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    正解: {item.choices[item.correctIndex]}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* アクション */}
      <section className="mt-6 card reveal" style={{ animationDelay: "240ms" }}>
        <form action={continueSessionFormAction} className="space-y-4">
          <input type="hidden" name="topic" value={result.topic} />
          <input type="hidden" name="mode" value={result.mode} />
          <div className="flex flex-wrap items-center gap-3">
            <ContinueButton />
            <Link href="/learn" className="btn btn-ghost">別のトピックへ</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
```

### `complete/page.tsx` の変更

```typescript
// src/app/(features)/learn/[sessionId]/complete/page.tsx
export default async function LearnSessionComplete({ params }: PageProps) {
  const { sessionId } = await params;
  const result = await getSessionResult(sessionId); // 新規クエリ関数

  return <SessionCompletePage result={result} sessionId={sessionId} />;
}
```

---

## 影響を受けるファイル

| ファイル | 変更種別 | 内容 |
|----------|----------|------|
| `src/server/quiz/query.ts` | 変更 | `getSessionResult` 関数を追加 |
| `src/app/(features)/learn/_components/SessionCompletePage.tsx` | 変更 | `SessionResult` 型を受け取りスコア・結果一覧を表示するよう変更 |
| `src/app/(features)/learn/[sessionId]/complete/page.tsx` | 変更 | `getSessionSnapshot` → `getSessionResult` に変更 |
| `tests/` | 追加 | `getSessionResult` のユニットテストを追加 |

---

## 非機能要件

| 項目 | 内容 |
|------|------|
| パフォーマンス | `attempts` は 1 セッション最大 20 件のため追加 DB クエリの負荷は軽微 |
| SSR | complete ページは Server Component のまま維持。クライアント状態不要 |
| 型安全 | `SessionResult` 型を `query.ts` に定義しコンポーネントと共用 |

---

## 未解決事項

- 復習問題（`source_question_id` あり）をリザルト上で区別して表示するか → 今回は区別しない（シンプルさ優先）
- `attempts` が存在しない（セッション未完了でURLを直叩き）場合の扱い → `totalCount` に対して空の `items` を表示するのみ（エラーにしない）
