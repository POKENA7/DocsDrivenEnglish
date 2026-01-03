# /speckit.tasks Command Workflow

このドキュメントは `/speckit.tasks` が tasks.md を生成する際の期待事項を定義する。

## Inputs

- specs/[###-feature-name]/spec.md（user stories と acceptance scenarios）
- specs/[###-feature-name]/plan.md（structure/constraints/performance goals/testing 方針）
-（存在する場合）contracts/, data-model.md
- Constitution: `.specify/memory/constitution.md`

## Output

- specs/[###-feature-name]/tasks.md

## Rules

- tasks は user story 単位でグルーピングし、各 story が独立に実装・検証できる粒度にする
- behavior changes がある story には tests tasks を含める（Constitution 準拠）
- 各 task には具体的な file path を含める
- 並列可能なものは `[P]` を付け、同一 file 競合を避ける
