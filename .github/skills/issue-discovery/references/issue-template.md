# Issue Template

Use this structure when drafting or creating an issue.

## Title pattern

- Improvement: `<module or concern> を <goal> する`
- Feature: `<user outcome> を追加する`

Keep the title concrete and implementation-sized.

## Body template

```md
## 背景
[現在の問題、またはコードベースから見える機会を 2〜4 文で書く]

## 根拠
- path/to/file.ts:12
- path/to/other-file.ts:34

## やりたいこと
- [実装の方向性を 2〜4 点]

## 期待する効果
- [保守性、性能、DX、ユーザー価値など]

## 受け入れ条件
- [ ] [観測可能な完了条件]
- [ ] [必要ならテストや検証条件]
```

## Acceptance criteria guidance

- 実装タスクとして着手可能な粒度にする
- 曖昧な表現より、対象モジュールや振る舞いを書く
- 既存挙動を維持する前提なら、その旨を明記する
- テスト追加が必要なら条件に含める

## Good examples

- `OpenAI Responses API の応答処理を型ガードベースに整理する`
- `startQuizSession と startSharedQuizSession の重複ロジックを整理する`
- `学習履歴から次に学ぶトピック候補を提示する`