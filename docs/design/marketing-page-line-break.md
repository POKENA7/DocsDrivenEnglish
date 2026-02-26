# マーケティングページ 日本語改行改善 設計書

## 背景・問題

マーケティングページ (`frontend/src/app/(marketing)/page.tsx`) において、日本語テキストの自動改行位置が語句の途中で切れるケースが発生しており、視認性が悪い。

### 問題箇所（スクリーンショット確認）

| 箇所 | 現状 |
|------|------|
| ヒーロー説明文 | 「AI」と「が」の間・「技術英語」の途中など意味単位で切れない |
| カード 02 説明文 | 「ユーザ」「ーの」など語中で改行される |
| カード 03 説明文 | 「不正解問題は」など文節を跨いで改行される |

---

## 原因

ブラウザのデフォルト日本語改行アルゴリズムは文字単位（Unicode Line Breaking Algorithm）で折り返すため、**意味のある語句や文節の途中で改行**が起きやすい。

---

## 解決方針

### 方針 A: CSS `word-break: auto-phrase`（推奨）

Chrome 119+ で実装された CSS プロパティ。ブラウザ内蔵の ICU ライブラリが日本語文節を解析し、語句境界で折り返す。追加マークアップ不要で最もメンテナンスしやすい。

```css
word-break: auto-phrase;
```

- ✅ マークアップへの変更ゼロ
- ✅ 将来的に自動で最適化される
- ⚠️ 非対応ブラウザ（Firefox / Safari）でデグレードするが、現状と同等の表示になるだけで**視認性は悪化しない**

### 方針 B: `<wbr>` タグによる手動ヒント

改行を許可したい位置に `<wbr>` を挿入する。対応ブラウザ問わず確実だが、テキスト変更のたびに手動メンテが必要でコストが高い。

### 方針 C: テキスト書き換え

1行に収まる文字数に収めるよう文章を短縮・分割する。デザイン変更が伴い副作用が大きい。

---

## 採用方針

**方針 A（`word-break: auto-phrase`）を採用する。**

Progressive Enhancement として実装し、対応ブラウザでは語句単位の折り返し、非対応ブラウザでは現状維持と同等の挙動になるため、デグレードリスクがない。

---

## 実装詳細

### 変更ファイル

`frontend/src/app/globals.css`

### 変更内容

日本語本文テキストに対して `word-break: auto-phrase` を付与するユーティリティクラスを定義し、マーケティングページの説明文・カード説明文に適用する。

**Option 1: globals.css にユーティリティ定義**

```css
/* globals.css に追記 */
.text-ja {
  word-break: auto-phrase;
}
```

**Option 2: Tailwind の任意値クラスをインライン指定**

Next.js + Tailwind 環境では `[word-break:auto-phrase]` のような任意値クラスが使用可能。グローバルな副作用を避けたい場合はこちらを使う。

```tsx
<p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground [word-break:auto-phrase]">
```

### 適用箇所（`page.tsx`）

| 要素 | 適用するクラス追加 |
|------|--------------------|
| ヒーロー説明文 `<p>` | `[word-break:auto-phrase]` |
| カード 01 説明文 `<p>` | `[word-break:auto-phrase]` |
| カード 02 説明文 `<p>` | `[word-break:auto-phrase]` |
| カード 03 説明文 `<p>` | `[word-break:auto-phrase]` |

Tailwind の任意値クラスを直接 JSX に記述することで、グローバルスタイルへの副作用を最小化する（Option 2 を採用）。

---

## 影響範囲

- `frontend/src/app/(marketing)/page.tsx` のみ
- テスト変更不要（UI 表示のみ）
- SPEC.md 変更不要（機能変更なし）

---

## 受け入れ基準

- [ ] Chrome 最新版でヒーロー説明文・カード説明文が文節単位で折り返される
- [ ] Firefox / Safari で現状より視認性が悪化しない
- [ ] `pnpm run lint` / `pnpm run format:check` が通る
