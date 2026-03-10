---
name: issue-discovery
description: Generate concrete feature ideas and improvement tasks from a real codebase, then turn them into issue-ready proposals or GitHub issues. Use when the user asks to find refactoring, design, performance, test, DX, or product opportunities from existing code, avoid duplicate tickets, and write issues with evidence and acceptance criteria.
---

# Issue Discovery

Inspect the current codebase and convert concrete opportunities into issues that can be picked up without extra discovery work. Ground every idea in the current implementation, tests, schema, and product surface.

## Workflow

1. Classify the request.
	- If the user asks for new features, inspect routes, actions, server modules, schema, tests, and obvious UX gaps.
	- If the user asks for improvements, inspect duplication, weak typing, inconsistent errors, missing tests, performance bottlenecks, and unclear module boundaries.
	- If unspecified, return both feature ideas and improvement tasks in separate groups.

2. Gather evidence from code first.
	- Read implementation, tests, and schema before proposing anything.
	- Prefer code, tests, README, and SPEC.
	- Do not use docs/design as the source of ideas unless the user explicitly asks for design-doc-driven suggestions.
	- Require at least one concrete file reference per candidate.

3. Filter for issue-worthy scope.
	- Keep each candidate small enough for a focused PR.
	- Prefer root-cause improvements over style-only cleanup.
	- Merge overlapping findings into one issue rather than creating sibling tickets.

4. De-duplicate against current work.
	- If repository issue or PR tools are available, search open issues and PRs before creating new ones.
	- Skip or merge ideas that substantially overlap existing work.

5. Shape each issue before filing it.
	- State the problem or opportunity in one sentence.
	- Add concrete evidence from code.
	- Propose an implementation direction, not a full design doc.
	- Add acceptance criteria that make the issue directly actionable.
	- Use the template in `references/issue-template.md`.

6. Create or present issues.
	- If the user asked to file issues, create them.
	- Otherwise, return issue-ready drafts ordered by priority.
	- After creation, report the issue numbers and one-line rationale for each.

## Heuristics

Look for these signals:

- Repeated `JSON.parse`, `as unknown as`, manual mapping, or repeated query assembly
- Similar orchestration across sibling modules with only small behavioral differences
- Mixed exception styles in the same layer
- Missing unit tests around normalization, validation, or branching logic
- Auth, caching, serialization, or API boundary logic that is duplicated or underspecified
- UI or API flows that exist in code but have obvious missing follow-up states or edge coverage

Reject candidates that:

- only restate an existing document without code evidence
- are too broad to fit in one implementation ticket
- depend on product strategy with no signal in the current codebase
- amount to naming-only or formatting-only cleanup

## Output Rules

- Prefer 3 to 6 strong candidates over a long weak list.
- Order by impact and implementation clarity.
- Include file references for every issue.
- Write Japanese issue bodies unless the repository clearly uses another language.
- Keep acceptance criteria observable and testable.

## Reference

- Read `references/issue-template.md` before drafting or creating issues.
