# OpenAI Responses API 応答処理整理 設計書

## 背景・問題

`frontend/src/lib/openaiClient.ts` の `createOpenAIParsedText` は、OpenAI Responses API の structured output を共通で扱う重要な関数だが、現状は `response` から `status` と `incomplete_details` を読む箇所で `as unknown as { ... }` を使っている。

この形だと TypeScript が SDK の実型変化を追えず、SDK 更新時に壊れても検知しづらい。また、`output_parsed === null` の後に

- incomplete 判定
- `output_text` 空文字判定
- fallback の `JSON.parse`
- Zod 再検証

が連続しており、分岐の意図が読み取りづらい。

OpenAI SDK 6.15.0 の型定義では `responses.parse()` の返り値は `ParsedResponse<T>` であり、`output_parsed` / `output_text` / `incomplete_details` / `status` は公開された型として参照できることを確認済み。

## 目的

- `openaiClient.ts` から `as unknown as` を除去する
- incomplete / empty text / fallback parse の分岐を明示する
- `createOpenAIParsedText` の主要分岐を unit test で押さえる

## 対応方針

### 1. Responses API の戻り値をそのまま扱う

`response` 全体への二重キャストはやめ、`responses.parse()` が返す `ParsedResponse<T>` の公開プロパティをそのまま利用する。

これにより `status` / `incomplete_details` / `output_text` の参照が SDK 型に追従する。

### 2. 分岐判定を小さな関数に整理する

`createOpenAIParsedText` の本体は次の順番を維持する。

1. `output_parsed` があればそれを返す
2. incomplete 系応答なら専用エラーを投げる
3. `output_text` が空なら明示的にエラーを投げる
4. `output_text` を JSON として復元する
5. Zod で再検証して返す

ただし過度な抽象化は避け、意図が読みやすくなる最小限の helper に留める。

想定 helper:

- `isIncompleteResponse(response): boolean`
- `parseFallbackOutputText(rawText): unknown`

`isIncompleteResponse` は `response.status === "incomplete"` または `response.incomplete_details !== null` を判定するだけの薄い関数にする。

### 3. fallback 復元フローを読みやすくする

fallback の `JSON.parse` は専用 helper に寄せ、失敗時ログと rethrow を一箇所にまとめる。

これで `createOpenAIParsedText` 側は「なぜ fallback に入ったか」と「fallback が成功したか」に集中できる。

## テスト方針

新規で `frontend/tests/unit/openai-client.test.ts` を追加する。

対象ケース:

1. `output_parsed` がある場合はそのまま返す
2. `status: "incomplete"` または `incomplete_details` がある場合は incomplete エラーを投げる
3. `output_parsed` が `null` かつ `output_text` が空なら明示的なエラーを投げる
4. `output_parsed` が `null` でも `output_text` に JSON があれば fallback で復元できる
5. fallback の JSON が壊れている場合は `JSON.parse` エラーを伝播する

OpenAI クライアント自体は module mock で差し替え、`responses.parse` の戻り値だけを制御する。

## 変更対象

- `frontend/src/lib/openaiClient.ts`
- `frontend/tests/unit/openai-client.test.ts`

## 影響範囲

- `createOpenAIParsedText` を利用する `generate.ts` / `moreExplanation.ts` / `related-topics.ts`
- ただし公開 API と戻り値の形は変えないため、呼び出し側の修正は原則不要

## 検証

実装後は `frontend/` で以下を実行する。

- `pnpm run lint`
- `pnpm run test:run`
- `pnpm run format:check`
- `pnpm run build`

## 対象外

- OpenAI のプロンプト内容変更
- `createOpenAIParsedText` の公開シグネチャ変更
- OpenAI エラー体系の全面的な再設計
