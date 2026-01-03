# /speckit.specify Command Workflow

このドキュメントは `/speckit.specify` が feature 用のドキュメント構造を作る際の期待事項を定義する。

## Input

- ユーザーの要求（$ARGUMENTS）

## Output

- specs/[###-feature-name]/ ディレクトリと最低限の雛形（spec.md 等）

## Steps

1. feature 名とブランチ名を確定する（例: `123-feature-name`）
2. `spec-template.md` を元に specs/.../spec.md を作る
3. 次工程の /speckit.plan に必要なファイル配置を整える

## Notes

- Constitution は `.specify/memory/constitution.md` を参照する
- このコマンドは仕様（spec）を確定するものではなく、作業の枠組みを整える
