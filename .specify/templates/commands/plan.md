# /speckit.plan Command Workflow

このドキュメントは `/speckit.plan` が plan.md を生成する際の実行フロー（期待事項）を定義する。

## Inputs

- specs/[###-feature-name]/spec.md
-（存在する場合）specs/[###-feature-name]/research.md, data-model.md, contracts/
- プロジェクトの Constitution: `.specify/memory/constitution.md`

## Output

- specs/[###-feature-name]/plan.md

## Steps

1. spec.md を読み、P1 user journey（MVP）を特定する
2. Technical Context を埋める（Language/Dependencies/Testing/Performance Goals/Constraints）
3. Constitution Check を作成する
   - Core Principles 適合を確認
   - Deviations がある場合は理由と代替案を明記
4. Project Structure を具体パスで確定する
5. 次工程（/speckit.tasks）に必要な情報が plan.md に揃っていることを確認する

## Quality Bar

- performance goals/constraints が明記されている
- testing 方針が明記されている
- UX consistency に影響する決定がある場合、その理由と影響が書かれている
