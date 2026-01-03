<!--
Sync Impact Report

- Version change: template → 1.0.0
- Modified principles:
	- Template placeholder (Principle 1) → I. Code Quality (NON-NEGOTIABLE)
	- Template placeholder (Principle 2) → II. Testing Standards (NON-NEGOTIABLE)
	- Template placeholder (Principle 3) → III. UX Consistency
	- Template placeholder (Principle 4) → IV. Performance Requirements
	- Template placeholder (Principle 5) → V. Simplicity & Maintainability
- Added sections:
	- Quality Gates
	- Development Workflow
- Removed sections: none
- Templates requiring updates:
	- ✅ .specify/templates/tasks-template.md
	- ✅ .specify/templates/commands/plan.md (added)
	- ✅ .specify/templates/commands/specify.md (added)
	- ✅ .specify/templates/commands/tasks.md (added)
	- ✅ .specify/templates/commands/checklist.md (added)
	- ✅ .specify/templates/plan-template.md (reference satisfied)
	- ⚠ .specify/templates/spec-template.md (no change needed)
	- ⚠ .specify/templates/checklist-template.md (no change needed)
- Follow-up TODOs: none
-->

# DocsDrivenEnglish Constitution

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)
実装は常に読みやすく、変更に強く、レビュー可能であること。

- Code MUST be readable: 意図が伝わる naming、適切な module 分割、局所的な責務。
- Public API / contract の変更は明示し、互換性（backward compatibility）を意識する。
- Error handling は必須。失敗を握りつぶさず、呼び出し側に伝播可能にする。
- “動いたからOK”は禁止。lint/format/type check がある場合は MUST pass。

Rationale: 品質の低い変更は将来コストと不具合を増幅させるため。

### II. Testing Standards (NON-NEGOTIABLE)
変更の安全性を tests で担保し、回帰を防ぐ。

- Behavior が変わる変更（bug fix を含む）は automated tests を MUST add。
- Tests は deterministic（flaky 禁止）。時間依存/乱数/外部I/O は制御する。
- 最低限の指針:
	- unit: pure logic / boundary validation
	- integration: 主要な user journey / contract
- Bug fix は regression test を先に追加し、再発防止を明確にする。

Rationale: 「再現 → 防止」のループをコードベースに刻むため。

### III. UX Consistency
UI/文章/操作の一貫性を最優先し、学習コストと誤操作を減らす。

- 既存の pattern / component / wording がある場合、MUST reuse。
- 新しい interaction や情報設計を導入する場合、既存との差分と理由を spec/plan に明記する。
- Error message は利用者の行動に繋がる内容にする（次の一手が分かる）。

Rationale: 一貫性の欠如は UX の劣化とサポートコスト増加を招くため。

### IV. Performance Requirements
performance は後回しにせず、目標と計測をセットで扱う。

- Performance goals / constraints は plan に MUST define（例: latency p95、throughput、memory）。
- 変更で hot path が増える場合、計測（benchmark / profiling / trace）または根拠を MUST provide。
- Regression を許容する場合は、理由・影響範囲・緩和策をドキュメント化し合意を取る。

Rationale: 計測なしの最適化・劣化はどちらも技術負債になり得るため。

### V. Simplicity & Maintainability
過剰設計を避け、必要十分な設計で長期保守性を確保する。

- 追加の abstraction / dependency は「何を簡単にするか」を説明できる場合にのみ導入する。
- 同じルールを複数箇所に複製しない（single source of truth）。
- 迷ったらまず simplest thing that could work。後から測定して改善する。

Rationale: 複雑さは品質・速度・UX すべてを下げるため。

## Quality Gates
各成果物は、最低限以下を満たす。

- Spec は user scenarios と acceptance scenarios を含む（spec-template の mandatory セクション）。
- Plan は technical context と performance goals/constraints を含む。
- Tasks は user story 単位で独立実装・独立検証できる粒度にする。
- Code review で「Core Principlesへの適合」を確認する。
- Deviations（例: tests を書かない）は例外扱いとし、plan の Constitution Check に明記する。

## Development Workflow
Docs-driven の流れを基本とする。

1. `/speckit.specify` で feature 構造を作成する
2. `spec.md` で user scenarios/acceptance scenarios を確定する
3. `/speckit.plan` で plan（設計と調査）をまとめ、Constitution Check を通す
4. `/speckit.tasks` で tasks を user story 単位に分解する
5. 実装 → tests → review → 反復

変更が大きい場合は、migration plan（移行手順/互換性）をドキュメントに含める。

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

この Constitution は `.specify` 配下のテンプレートおよび feature docs の上位規範とする。

- Amendments: 改定は PR で行い、変更理由・影響範囲・移行方針を記述する。
- Versioning: Constitution は SemVer（MAJOR.MINOR.PATCH）で管理する。
	- MAJOR: 原則の削除/再定義など後方互換性のない変更
	- MINOR: 原則/セクションの追加、実務に影響する指針の拡張
	- PATCH: 表現の明確化、typo、意味を変えない修正
- Compliance review: すべての plan/review は Core Principles 適合を確認する。
- Propagation: 憲法改定時は `.specify/templates/*` の整合も同一PRで更新する。

**Version**: 1.0.0 | **Ratified**: 2026-01-03 | **Last Amended**: 2026-01-03
<!-- Example: Version: 2.1.1 | Ratified: 2025-06-13 | Last Amended: 2025-07-16 -->
