# Autonomous Engineering

**An open plan for building software with AI agents and risk-based autonomy.**

AI agents can already write code, run tests, and review pull requests. The challenge is getting reliable changes merged without making a person the bottleneck for every release — or giving up security, accountability, and the ability to roll back.

This repository documents **the technical plan I'm working on to solve that problem**: risk classification based on the actual diff, independent reviewing agents, CI and security evidence tied to the commit, protected permissions, progressively automated merges, and rollback mechanisms.

The idea is straightforward: **automate what can be verified, and keep humans responsible for decisions that actually require their judgment.** This plan is for founders and small teams that want to ship more without assuming AI-generated code is safe by default.

> **Status: architecture proposal, not a finished system.** There is no working bot, validated pipeline, or demonstrated production outcome here. The plan must be adapted and tested before enabling automatic merges.

## The idea in one table

| Change class | Human review | Proposed merge policy |
| --- | --- | --- |
| **T3 · low risk and eligible** | No mandatory human approval | Auto-merge **after** CI, independent review, security checks, and every other required gate |
| **T2 · medium risk** | One human approval by default | Automation can perform the merge after approval; future exceptions require evidence |
| **T1 · high risk or governance** | Mandatory human approval, potentially from two people | Automation may execute the approved merge, but must never bypass the risk policy |

**T3 does not automatically mean auto-merge.** Only explicitly approved categories of low-risk changes should qualify. Any new commit invalidates evidence tied to the previous reviewed SHA.

## Where to start

Read the [full technical plan](./PLAN.md). It covers:

1. Risk classification based on the actual diff.
2. Permissions, protected paths, and separation between implementer and reviewer.
3. Automated review and evidence validation.
4. Safe merging, autonomy limits, and rollback.
5. Adoption stages, acceptance tests, and metrics.

If you're starting from scratch, **don't enable auto-merge on day one**. Start in *shadow mode*: the system records which PRs would qualify while people still approve the merges. Expand autonomy only after verifying that the gates work.

## How to use this repository

1. **Set the boundaries.** Read the T1/T2/T3 policy in the [plan](./PLAN.md), compare it against your product, and identify code that should never be merged without approval.
2. **Audit what you have.** Check CI, bot permissions, branch protection, test quality, and whether reviews can be traced to a specific SHA. Don't use auto-merge to work around gaps in that audit.
3. **Run in shadow mode.** For a few weeks, record which changes would have qualified and compare those decisions with actual reviews.
4. **Expand based on evidence.** Start with small, reversible categories. Track incidents, reverts, and human time per correctly delivered change.

The plan includes a conceptual architecture, risk criteria, rollout stages, gates, and acceptance scenarios. **The only runnable piece is the shadow mode action below, and it only comments on pull requests.** Everything else is still a plan, not a production-ready auto-merge system.

## What this is — and what it isn't

**It is:** an operating proposal that founders and small teams can adapt to their own codebase, stack, and risk tolerance. The examples are illustrative, not tested configurations or universal rules.

**It isn't:** a plug-and-play tool, a guarantee of security, a copy of another company's internal process, or a claim that these automations are already running.

The goal isn't to maximize the number of automatically merged PRs. It's to **ship more correct changes per human hour without increasing incidents or reverts**.

## Try it in 5 minutes: shadow mode

This repository now includes one small, runnable piece: a GitHub Action that classifies every pull request into T1, T2, or T3 from the actual diff and posts a single comment saying whether it **would** be eligible for auto-merge. **It only comments.** It never approves, merges, labels, or blocks anything, so you can run it next to your current review process with no risk.

1. Copy [`.autonomy.yml`](./.autonomy.yml) to the root of your repository and adjust the paths to your product (auth, billing, migrations, infrastructure).
2. Copy [`.github/workflows/shadow-mode.yml`](./.github/workflows/shadow-mode.yml) and change `uses: ./action` to `uses: richardrx/autonomous-engineering/action@main` (pin a commit SHA once you trust it).
3. Open a pull request. The comment shows the computed tier, the reasons per file, and the head SHA the result applies to.

How it decides:

- Files not covered by the policy fall back to `default_tier` (T2). With no policy file at all, everything is T2 and nothing is eligible.
- A PR is T3 only if **every** file matches an approved low-risk class in `t3_paths` and the diff is small.
- Rules and size limits can only raise the tier. A label or a `tier: T3` line in the PR description can never lower it.
- Agent instruction files (`AGENTS.md`, `CLAUDE.md`, `.cursor/`, `.claude/`), `.github/`, `CODEOWNERS`, and the policy file itself are always T1.
- The policy is read from the base commit, so a PR cannot relax its own rules.

Note on forks: on pull requests opened from forks, GitHub gives the workflow a read-only token, so the comment step will likely fail there. The classification and job summary still run. We deliberately do not use `pull_request_target`, because it runs with write access next to untrusted code.

Plain Node, no npm dependencies. Run the tests with `node --test action/test/`.

Let it run for a few weeks, then compare its answers with what your reviewers actually decided. That comparison is the evidence you need before turning on any real auto-merge.

## References

- [How the Claude Code team does code review](https://claude.dev/blog/solving-code-review-at-anthropic/) — Anthropic, October 15, 2026.
- [Redesigning source control at Anthropic](https://www.anthropic.com/research/redesigning-source-control) — Anthropic, October 13, 2026.
- [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/) — OpenAI, February 11, 2026.

These published practices are **references**, not a blueprint copied wholesale. The T1/T2/T3 tiers, workflow, criteria, and examples here are **my proposed adaptation**, not a literal account of how those companies operate internally.

## License

[MIT](./LICENSE). You may reuse and adapt this material under the license terms.

---

Want to set this up on your team? Talk to me on X: [@richardrx](https://x.com/richardrx).
