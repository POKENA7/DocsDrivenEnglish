# /speckit.checklist Command Workflow

このドキュメントは `/speckit.checklist` が checklist を生成する際の期待事項を定義する。

## Inputs

- spec.md / plan.md / tasks.md
- ユーザーのチェック観点（例: release readiness, security, performance）
- Constitution: `.specify/memory/constitution.md`

## Output

- specs/[###-feature-name]/checklists/*.md（または指定されたパス）

## Quality Bar

- 各チェック項目は「実行可能」で「合否判定可能」であること
- tests / UX consistency / performance requirements を必要に応じて含める
- 例外（deviation）がある場合は、その妥当性を確認できる項目を含める
