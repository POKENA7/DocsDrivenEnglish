# React / Next.js ベストプラクティス違反箇所リファクタリング設計書

## 概要

Vercel Engineering の React Best Practices ガイドラインをベースに、`frontend/src` 全体のコードを調査した結果、4 つの改善箇所を特定した。  
本設計書はそれぞれの問題の内容、対象ファイル、修正方針をまとめたものである。

---

## 1. `useEffect` による状態同期（Anti-pattern: `rerender-derived-state-no-effect`）

### 対象ファイル

`frontend/src/app/(features)/learn/_hooks/useMoreExplanation.ts`

### 現状の問題

```typescript
useEffect(() => {
  setMoreExplanation(null);
  setError(null);
}, [questionId]);
```

`questionId`（外部から渡される値）が変わったタイミングで `useEffect` を使って内部 state をリセットしている。  
この実装は以下の理由でアンチパターンである。

- **余分なレンダリングが発生する**: 値が変わった最初のレンダリングで古い state が残り、`useEffect` が走ってから再度レンダリングが起きる（合計 2 回レンダリング）。
- **`useEffect` の本来の用途ではない**: `useEffect` はブラウザ API や外部システムとの同期のために使う。props/値の変化に応じた state 初期化には不適切。

### 修正方針

フェッチ済みの説明とエラーを、それぞれ `questionId` とセットで state に持たせる。  
レンダリング中に「現在の `questionId` と一致するかどうか」で派生値として絞り込むことで、`useEffect` を使わずにリセットを実現できる。

```typescript
// 修正後
const [fetched, setFetched] = useState<{ questionId: string; text: string } | null>(null);
const [fetchError, setFetchError] = useState<{ questionId: string; message: string } | null>(null);
const [isFetching, setIsFetching] = useState(false);

const moreExplanation = fetched?.questionId === questionId ? fetched.text : null;
const error = fetchError?.questionId === questionId ? fetchError.message : null;
```

`fetch` 関数内でそれぞれ `setFetched({ questionId, text })` / `setFetchError({ questionId, message })` とセットするだけでよい。  
`questionId` が変わった瞬間のレンダリングから正しい値が返るため、`useEffect` は完全に削除できる。

---

## 2. `useMemo` による自明な配列アクセスのラップ（Anti-pattern: `rerender-simple-expression-in-memo`）

### 対象ファイル

`frontend/src/app/(features)/learn/_hooks/useQuizSession.ts`

### 現状の問題

```typescript
const current = useMemo(() => session.questions[index], [index, session.questions]);
```

`session.questions[index]` は O(1) の配列インデックスアクセスであり、計算コストがほぼゼロである。  
`useMemo` のオーバーヘッド（依存配列の比較、メモ化値の保持）の方がコストが高く、パフォーマンス面でむしろ不利になる。  
また、コードの読みやすさも低下する。

### 修正方針

`useMemo` を削除し、直接アクセスに変更する。

```typescript
// 修正後
const current = session.questions[index];
```

---

## 3. データ取得ページへの Suspense 境界の欠如（`async-suspense-boundaries`）

### 対象ファイル

- `frontend/src/app/(features)/learn/[sessionId]/page.tsx`
- `frontend/src/app/(features)/learn/[sessionId]/complete/page.tsx`
- `frontend/src/app/(features)/review-queue/page.tsx`

### 現状の問題

非同期データフェッチを行っている Server Component ページに `<Suspense>` が設定されていない。  
そのため、データ取得が完了するまでレスポンス全体がブロックされ、ユーザーにはページが完全に描画されるまで何も表示されない。

```tsx
// 現状: Suspense なし
export default async function LearnSessionPage({ params }: PageProps) {
  const { sessionId } = await params;
  const session = await getSessionSnapshot(sessionId); // ここでブロック
  return <SessionPage session={session} />;
}
```

### 修正方針

各対象ページに対応する `loading.tsx` を配置することで、Next.js の組み込みサスペンスを有効化する。

対象ディレクトリに `loading.tsx` を追加する:

```
src/app/(features)/learn/[sessionId]/loading.tsx
src/app/(features)/review-queue/loading.tsx
```

```tsx
// loading.tsx の実装例
export default function Loading() {
  return (
    <main className="container-page page">
      <div className="reveal animate-pulse">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="mt-2 h-4 w-72 rounded bg-muted" />
      </div>
    </main>
  );
}
```

あるいは、ページ内の遅延コンポーネントを明示的に `<Suspense fallback={...}>` で囲む方法でも対応可能。

---

## 4. `page.tsx` の責務過多（構造・一貫性の問題）

### 対象ファイル

- `frontend/src/app/(features)/learn/page.tsx`
- `frontend/src/app/(features)/review-queue/page.tsx`

### 方針

`page.tsx` は認証・ルーティングのみを担い、データフェッチや表示ロジックは `_components/` 配下の Server Component に委譲する。  
`history/page.tsx` はすでにこのパターンに従っているため、こちらが正規の形である。

```tsx
// history/page.tsx（正規パターン）
import HistoryPage from "./_components/HistoryPage";
export default function HistoryIndexPage() {
  return <HistoryPage />;
}
// _components/HistoryPage.tsx が auth + data fetch + rendering を担う
```

### 現状の問題

`learn/page.tsx` は認証・データフェッチを直接行っている。

```tsx
// learn/page.tsx（現状）
export default async function LearnIndexPage() {
  const { userId } = await auth();
  const dueCount = userId ? await getDueReviewCount(userId) : 0;
  return <LearnPage dueCount={dueCount} />;
}
```

`review-queue/page.tsx` はさらに多く、認証・データフェッチ・ページ全体の JSX を page.tsx に直書きしている。

### 修正方針

両ページとも `_components/` に Server Component を切り出し、`page.tsx` は委譲のみとする。

```tsx
// 修正後の learn/page.tsx
import LearnIndexServer from "./_components/LearnIndexServer";
export default function LearnIndexPage() {
  return <LearnIndexServer />;
}

// _components/LearnIndexServer.tsx（新規・Server Component）
export default async function LearnIndexServer() {
  const { userId } = await auth();
  const dueCount = userId ? await getDueReviewCount(userId) : 0;
  return <LearnPage dueCount={dueCount} />;
}
```

```tsx
// 修正後の review-queue/page.tsx
import ReviewQueuePage from "./_components/ReviewQueuePage";
export default function ReviewQueueIndexPage() {
  return <ReviewQueuePage />;
}

// _components/ReviewQueuePage.tsx（新規・Server Component）
// 既存の review-queue/page.tsx の内容をそのまま移動する
```

---

## 優先度まとめ

| # | 問題 | カテゴリ | 優先度 |
|---|------|----------|--------|
| 1 | `useEffect` による状態同期 | Re-render Optimization | 高 |
| 2 | `useMemo` の不要な使用 | Re-render Optimization | 中 |
| 3 | Suspense 境界の欠如 | Waterfall / Streaming | 中 |
| 4 | `page.tsx` の責務過多 | 構造・一貫性 | 低 |

---

## 変更ファイル一覧

| ファイル | 操作 |
|----------|------|
| `src/app/(features)/learn/_hooks/useMoreExplanation.ts` | 修正（`useEffect` 削除） |
| `src/app/(features)/learn/_hooks/useQuizSession.ts` | 修正（`useMemo` 削除） |
| `src/app/(features)/learn/page.tsx` | 修正（委譲のみに変更） |
| `src/app/(features)/learn/_components/LearnIndexServer.tsx` | 新規作成（auth + data fetch） |
| `src/app/(features)/review-queue/page.tsx` | 修正（委譲のみに変更） |
| `src/app/(features)/review-queue/_components/ReviewQueuePage.tsx` | 新規作成（既存 page.tsx の内容を移動） |
| `src/app/(features)/learn/[sessionId]/loading.tsx` | 新規作成 |
| `src/app/(features)/review-queue/loading.tsx` | 新規作成 |
| `src/app/(features)/review-queue/loading.tsx` | 新規作成 |
