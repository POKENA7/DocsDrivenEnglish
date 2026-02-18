# 設計書: トピックベースクイズ生成

**作成日**: 2026-02-18  
**ステータス**: Draft

---

## 背景・課題

現在の実装では、ユーザーが入力した URL のページ本文をそのまま教材として LLM に渡し、クイズを生成している。

これには以下の問題がある。

1. **学習範囲が狭い** — 1ページ分の内容しか出題できない。ページの情報量が少ない場合は5問すら作れないことがある。
2. **毎回ほぼ同じ問題が出る** — 同じ URL を使うと同じテキストを LLM に渡すため、出題パターンがほぼ固定される。

---

## 解決方針

**URL 入力をやめ、ユーザーが「勉強したい技術要素」を直接テキストで入力する形式に変更する。**

```
Before: URL（ページ本文） → クイズ
After:  技術トピック文字列（例: "React Hooks", "Android Jetpack Compose"） → クイズ
```

LLM 自身が持つ技術知識を使って多様な問題を生成するため、毎回異なる問題が出やすくなる。  
また、URL 取得・HTML パースのステップが丸ごと不要になり、処理もシンプルになる。

---

## 入力インターフェース

### 変更前（URL 入力）

```
┌─────────────────────────────────────────┐
│ URL                                     │
│ [https://...                          ] │
│                                         │
│ Mode: ○ word  ○ reading                │
│                                         │
│ [学習開始]                              │
└─────────────────────────────────────────┘
```

### 変更後（技術トピック入力）

```
┌─────────────────────────────────────────┐
│ 学習したい技術・トピック                │
│ [React Hooks                          ] │
│ 例: useEffect, Android Coroutines, ...  │
│                                         │
│ Mode: ○ word  ○ reading                │
│                                         │
│ [学習開始]                              │
└─────────────────────────────────────────┘
```

- 入力フィールドの `type="url"` を `type="text"` に変更
- プレースホルダー例: `React Hooks`, `Android Jetpack Compose`, `Kubernetes Pod`
- バリデーション: 空文字・空白のみは不可。それ以外の入力制限は設けない

---

## クイズ生成プロンプト設計

### 現行

```
入力: ページ本文全文
プロンプト: "以下のテキストを教材にクイズを生成してください"
```

### 変更後

```
入力: ユーザーが入力した技術トピック文字列（例: "React Hooks"）
プロンプト: 以下参照
```

#### クイズ生成プロンプト（変更差分）

既存プロンプトの「入力テキスト」セクションを以下に置き換える。

```
技術トピック: {topic}  （例: React Hooks, useEffect, dependency array）

【生成指針】
- 上記の技術トピックに関連した英語技術ドキュメント（公式ドキュメント・仕様書・RFC 等）に
  実際に出てくるような英単語・英語フレーズ・英文を題材にすること。
- 実在する記述を想定した問題にし、造語・架空の用語は使わないこと。
- 同一セッション内で同じ単語・フレーズを重複して出題しないこと。
- word モード: トピックに深く関連した英単語/英語フレーズを題材にする。
- reading モード: トピックの説明文として公式ドキュメントに出てきそうな英文（3〜5文）を
  自ら構成し、その読解を問う。
```

---

## データモデルの変更

### `study_sessions` テーブル

| カラム | 変更内容 |
|--------|----------|
| `inputUrl` TEXT | **削除**。URL 入力をやめるため不要になる。 |
| `topic` TEXT NOT NULL | **新規追加**。ユーザーが入力した技術トピック文字列を保存する。 |
| `sourceUrl` TEXT | **削除**。ドキュメント取得をやめるため不要になる。 |
| `sourceQuoteText` TEXT | **削除**。ページ本文引用をやめるため不要になる。 |
| `title` TEXT | **削除**。ページタイトルが存在しなくなるため不要になる。 |

### `questions` テーブル

| カラム | 変更内容 |
|--------|----------|
| `sourceUrl` TEXT | **削除** |
| `sourceQuoteText` TEXT | **削除**。問題の根拠テキストは `prompt` 内の「原文:」セクションに統合される。 |

---

## API 変更

### `POST /api/quiz/sessions`（セッション開始）

**リクエストボディの変更**

```typescript
// Before
{ url: string; mode: "word" | "reading" }

// After
{ topic: string; mode: "word" | "reading" }
```

**処理フローの変更**

```
現行:
  1. URL からドキュメント取得（fetchAndExtractDocument）
  2. 本文テキストを抽出・整形
  3. 本文テキストをクイズ生成に渡す

変更後:
  1. topic 文字列のバリデーション（空文字チェックのみ）
  2. topic をクイズ生成に渡す
  ※ ドキュメント取得ステップを完全に削除
```

**レスポンスの変更**

```typescript
// StartSessionResponse の変更
{
  sessionId: string;
  plannedCount: number;
  actualCount: number;
  topic: string;          // 追加（inputUrl・title の代替）
  questions: Array<{
    questionId: string;
    prompt: string;
    choices: Array<{ index: number; text: string }>;
    // sourceUrl, sourceQuoteText を削除
  }>;
}
```

### `document.ts`

URL 取得・HTML パース処理は完全に不要になるため、**このファイルを削除する**。

---

## UI 変更

### 学習開始画面（`/learn`）

- `LearnPage.tsx`: URL 入力フィールド（`type="url"`）を「技術トピック」テキスト入力（`type="text"`）に変更
- `useLearnStart.ts`: `FormData` から `topic` を取得するよう変更（`url` → `topic`）
- `POST /api/quiz/sessions` に `{ topic, mode }` で送信

### クイズ画面（`/session/[id]`）

- `SourceAttribution.tsx`: URL・引用テキストを表示するコンポーネントを**削除**
- セッションの `topic` を画面上部に表示する（例: `学習トピック: React Hooks`）

### セッション完了画面（`/session/[id]/complete`）

- `sourceUrl` 参照を削除し、`topic` を表示する

---

## 影響を受けるファイル一覧

| ファイル | 変更種別 | 内容 |
|----------|----------|------|
| `src/app/api/[[...route]]/quiz.ts` | 変更 | `url` → `topic` 入力、ドキュメント取得削除、プロンプト変更 |
| `src/app/api/[[...route]]/document.ts` | **削除** | URL 取得・HTML パース処理が不要に |
| `src/db/schema.ts` | 変更 | `inputUrl`/`sourceUrl`/`sourceQuoteText`/`title` 削除、`topic` 追加 |
| `src/db/migrations/` | 追加 | Drizzle migration ファイル生成 |
| `src/app/(features)/learn/_components/LearnPage.tsx` | 変更 | 入力フィールドを topic text input に変更 |
| `src/app/(features)/learn/_hooks/useLearnStart.ts` | 変更 | `url` → `topic` フィールド取得 |
| `src/app/(features)/session/_components/SourceAttribution.tsx` | **削除** | URL 引用表示が不要に |
| `src/app/(features)/session/_components/SessionPage.tsx` | 変更 | SourceAttribution 削除、topic 表示追加 |
| `src/app/(features)/session/_components/SessionCompletePage.tsx` | 変更 | `sourceUrl` 参照を `topic` に変更 |
| `src/app/(features)/session/_api/query.ts` | 変更 | `sourceUrl` → `topic` 参照 |
| `src/lib/honoRpcClient.ts` | 変更 | 型定義の追従 |
| `tests/` | 変更 | URL 関連テストを topic 向けに更新 |

---

## 非機能要件

| 項目 | 内容 |
|------|------|
| レイテンシ | URL 取得・HTML パースのステップが丸ごとなくなるため、セッション開始が **高速化** される。 |
| コスト | ドキュメント取得なし、LLM 呼び出しは1回のまま。コスト増なし。 |
| テスト | URL 関連の integration tests を topic ベースに書き換える。 |

---

## 未解決事項（TODO）

- [ ] 入力トピックのバリデーション強度をどこまで設けるか（例: 最大文字数）
- [ ] 履歴画面での表示: 現行は `inputUrl` を表示していたが、`topic` に差し替える
- [ ] `SourceAttribution` 削除に伴い、問題の根拠テキストを `prompt` 内の「原文:」セクションのみとするか、別途 LLM に参考文献 URL を生成させるか検討する
