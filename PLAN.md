# Technical plan: agent-driven engineering with risk-based autonomy

> **Status:** an open proposal for discussion and gradual implementation. This is not a finished, validated, or deployed system, nor an audit of any specific repository.
>
> **Audience:** founders, engineers, and small teams that want agents to implement, review, test, and merge changes within explicit risk controls.
>
> **Operating principle:** humans decide goals, boundaries, and consequential exceptions. Agents can execute verifiable work inside those boundaries.

## 1. The problem and the goal

Agents can produce code faster than humans can review pull requests. Requiring someone to review and click merge on every change limits autonomy. Removing reviews indiscriminately just moves the cost to production incidents.

The goal is to reduce **human attention required per correct change shipped**. A higher auto-merge rate only counts as progress if regressions, reverts, and incidents stay within approved limits.

This plan describes a target architecture, its dependencies, and a safe way to roll it out. No illustrative configuration should be applied without validating it against the target repository.

### Principles

1. **Risk determines supervision.** The actual diff matters more than the PR's stated intent, size, or label.
2. **Evidence beats claims.** Agents must attach test and check results, not merely say they passed.
3. **Separation of powers.** Implementers cannot weaken their own controls or dismiss their own critical findings.
4. **Verification is tied to the code.** Reviews and approvals must refer to the current HEAD SHA and the relevant base.
5. **Fail closed.** A missing, failed, or unavailable required gate blocks auto-merge.
6. **Rollback is part of the design.** Merge authorization accounts for reversibility and observability.
7. **Autonomy is earned through evidence.** Every expansion must demonstrate that the controls work.
8. **Documentation must be navigable and verifiable.** A short entry point links to rules, approved examples, and legacy patterns to avoid.

## 2. Risk policy

These tiers are **a proposed convention**, not an official classification from any vendor.

| Tier | Default oversight | Possible examples | Merge policy |
| --- | --- | --- | --- |
| **T3 — low risk** | Zero human approvals **for previously authorized classes** | Non-normative documentation, isolated visual changes, small additional tests | Auto-merge only when eligible and every required gate passes |
| **T2 — medium risk** | One human approval initially | Routine features, reversible behavior changes, refactoring backed by tests | Automation may merge after authorization; selective exemptions require evidence |
| **T1 — high risk** | One or two human approvals depending on criticality and team policy | Authorization, sensitive data, billing, destructive changes, critical infrastructure, agent governance | Automation may perform the mechanical merge after all required approvals, but cannot waive them |

### 2.1 Tier is not the same as eligibility

A T3 PR can still be ineligible for auto-merge. For example, when it:

- Changes the agent's own configuration or identity.
- Modifies instructions, evaluation criteria, or security checks.
- Affects a shared contract, sensitive workflow, or code with insufficient coverage.
- Introduces an external dependency, migration, or behavior that's hard to reverse.
- Lacks reliable independent review, CI, or security evidence.
- Has too many unrelated changes, or a scope too broad for its authorized class.

**Precedence rule:** the final tier is the highest risk found across the files, diff contents, dependencies, and system impact. An author's declared tier cannot lower it.

### 2.2 Risk signals

Assess at least:

- Touched paths and the nature of each change, including removed and renamed files.
- Access filters, multi-tenant queries, and authorization changes.
- Money, authentication, credentials, privacy, and critical integrations.
- API contracts, schemas, migrations, deployment configuration, and permissions.
- Global state, middleware, hooks, and application initialization.
- Dependencies, lockfiles, and scripts executed by CI.
- Governance: rulesets, CODEOWNERS, workflows, policies, prompts, and gate code.
- Reversibility, test coverage, exposed surface area, and blast radius.

Don't base the entire classification on regexes over the diff. Static rules are useful for objective signals. Cases that cannot be classified safely must be escalated to a higher tier or to a human.

### 2.3 Human authorization versus executing a merge

These are separate actions: implementing, reviewing code, approving risk, and executing the merge. A bot may perform the merge **after** the required human approval. That does not make the approval autonomous.

## 3. Permissions and protecting the rules

The architecture separates four roles:

| Role | Can do | Cannot do |
| --- | --- | --- |
| Implementing agent | Edit authorized code, run tests, open and update PRs | Change protected governance or dismiss blockers |
| Reviewing agent | Inspect the diff and evidence, report findings, issue an independent verdict | Approve its own work or impersonate a human |
| Controller / merge automation | Validate policy, publish status, merge explicitly authorized PRs | Bypass branch protection or accept stale evidence |
| Human owner | Define policy, approve high-risk changes, decide exceptions and incident response | — |

### 3.1 Defense in depth

No file that controls how agents are evaluated should be weakened by a routine, low-risk PR. Identify and protect, as applicable:

- `AGENTS.md`, `CLAUDE.md`, and equivalent instructions in subdirectories.
- Normative architecture documents, policies, review criteria, and approved references.
- Skills that encode mandatory rules.
- Controller configuration, scoring rubrics, classifiers, and regression tests.
- `.github/workflows/`, `.github/CODEOWNERS`, rulesets, and auto-merge configuration.
- Lint scripts, scanners, and tests that enforce these policies.

**CODEOWNERS alone is not sufficient protection.** Verify actual branch rules, required checks, approval policies, and the effective permissions of bot accounts.

An implementation can combine equivalents of `protectedPaths`, CODEOWNERS, and a required check. But the enforcement must not depend on code modified by the same PR being evaluated. A PR must not be able to replace its own validator with a weaker one and then pass that validator.

### 3.2 Identity and trust

Auto-merge depends on more than the change type. Require known identities, least-privilege access, explicit permissions for each role, and an audit trail. Unknown bot identities must fail closed.

## 4. The change pipeline

| Stage | Owner | Evidence / output | Failure or escalation |
| --- | --- | --- | --- |
| 1. Define the change | Human or authorized system | Goal, acceptance criteria, context, and scope | Incomplete requirements → clarify |
| 2. Classify initial risk | Classifier | Preliminary tier and reasons | Material uncertainty → higher tier |
| 3. Implement | Implementing agent | Small diff, isolated branch, tests | Repeated failure → human |
| 4. Run local checks | Agent + tools | Commands, logs, and test results | A skipped check is not a pass |
| 5. Review the diff | Separate agent / independent context | Findings with file, line, severity, and fix | Critical problem → block |
| 6. Review security | Security reviewer / pipeline | Verdict on relevant risks | Unavailable → block auto-merge |
| 7. Fix findings | Implementing agent | Updated diff and resolution records | Review limit reached → escalate |
| 8. Reclassify | Classifier | Final tier from the final diff | Higher tier → more approvals |
| 9. Validate evidence | Controller | CI, reviews, findings, SHA, identity, base | Stale/incomplete evidence → block |
| 10. Check GitHub rules | GitHub + controller | Rulesets, approvals, current branch state | Failure/conflict → block |
| 11. Merge | Authorized automation or human | Auditable merge; prefer a queue / revalidation when available | HEAD/base change → revalidate |
| 12. Monitor | Telemetry + operational owner | Regressions, reverts, incidents, recovery time | Circuit breaker and rollback |

### 4.1 Minimal state machine

`DISCOVERED → PLANNED → IMPLEMENTING → REVIEWING → FIXING → VALIDATED → MERGED → OBSERVED`

Exception states: `BLOCKED`, `NEEDS_HUMAN`, `REVERTED`. This is a suggested model, not an implemented software contract.

The controller records transitions, reasons, the responsible agent, reference SHA, and evidence. A change to HEAD SHA invalidates reviews, checks, and approvals that require the previous SHA. Changes to the base must trigger appropriate revalidation before merging.

### 4.2 Limit review loops

- First review: the full diff and its impact on the system.
- Subsequent reviews: focus on the new diff and outstanding findings without ignoring relevant regressions.
- Deduplicate findings and require explicit resolution.
- Suggested starting limit: **three rounds**, then escalate to a human.
- Don't treat style nits as security blockers.

## 5. Quality and security gates

The names below are categories of checks. Each project must map them to actual commands and record whether each check is required.

| Check | Evidence | Safe behavior |
| --- | --- | --- |
| Formatting and lint | The project's actual commands | Failure blocks merge |
| Types / build | Stack-specific commands | Failure blocks merge |
| Tests | Applicable unit, integration, and regression tests | Not run does not mean green |
| Contracts | Generated artifacts without drift | Differences require a fix |
| Dependencies | Licenses, vulnerabilities, and sensitive changes | Critical issues block; exceptions need recorded approval |
| Secrets | Scanning configured in CI and/or on the platform | Confirmed exposure blocks |
| Application security | Authorization, tenant isolation, sensitive data, external input | Blocking finding prevents auto-merge |
| Risk policy | Final tier and eligibility based on the diff | Failure/uncertainty prevents auto-merge |
| Independent review | Valid verdict tied to the SHA | Absence prevents auto-merge |
| GitHub | Checks, approvals, permissions, branch protection | Unmet requirements block merge |

**Don't claim coverage a gate doesn't provide.** For example, a linter that forbids importing `*.png` does not necessarily catch a new `.png` that isn't imported anywhere. Distinguish CI checks, local hooks, and manual review.

### 5.1 Findings and exceptions

Every finding should include a stable ID, severity, file and line where applicable, verifiable description, consequence, proposed fix, and resolution status.

Blocking security or data findings cannot be dismissed unilaterally by the agent that authored the change. Exceptions need an owner, justification, and deadline or condition for re-evaluation.

### 5.2 Reproducible convention checklist

For each approved criterion, the reviewer records:

- `pass`: concrete evidence in the diff.
- `violation`: evidence and a linked finding.
- `N/A`: explanation of why the criterion does not apply.

An adaptable example rubric: architecture, contracts, authorization, data isolation, persistence/transactions, error handling, testability, migrations, test coverage, use of API clients, separation of UI logic, reuse of business rules, secrets, observability, and documentation clarity.

**Don't adopt this list as policy automatically.** Each organization must approve the applicable criteria. New criteria do not count until accepted.

If a score from 0 to 15 is needed:

`score = floor(15 × passed items / applicable items)`

Additional rules:

1. Require **every active criterion**, exactly once, with unique IDs and no omissions.
2. Validate `pass`, `violation`, and `N/A` and the evidence for every entry.
3. Link each `violation` to a specific finding; comparing counts is not enough.
4. Recalculate the score in the controller. Don't trust a number supplied by an LLM.
5. Zero applicable criteria → **human escalation**, not a perfect score.
6. Record which version of the rubric was used to evaluate each diff.

One possible overall quality score (example, not a required standard) combines fidelity to the task 25, tests 25, blast radius 20, conventions 15, and simplicity 15. The controller must validate the sum and individual minimums instead of accepting the declared total.

### 5.3 Backward-compatible reviewer contract changes

If agent reviews use a strict JSON contract, don't change the prompt and validator simultaneously without compatibility:

1. **Expand:** accept the new field as optional and record its quality.
2. **Migrate:** start emitting the new field and compare results in shadow mode.
3. **Enforce:** make the field mandatory for approvals only after validation.

Plan for rollback, contract versioning, and tests covering both the old and new verdict formats.

## 6. Auto-merge policy

Automatic merging is an **authorization decision**, not an automatic consequence of a T3 label. Compute `eligibleForAutomerge` only after all checks, and re-evaluate it at merge time.

### 6.1 Authorization invariants

A PR may merge automatically only when **all** of these are true:

1. Its change class is explicitly authorized by the current policy.
2. Its final tier is calculated from the complete diff; touching protected paths blocks autonomous merging.
3. The agent's identity is authorized for its role.
4. Implementer and reviewer are independent as required by policy.
5. All required CI checks succeeded on the current SHA.
6. Required technical and security reviews are complete.
7. No blocking finding or unresolved blocking discussion remains open.
8. All human approvals required by the tier have been recorded for the correct revision.
9. HEAD SHA and the relevant base remain valid and have been revalidated.
10. The execution token has minimal permissions; GitHub enforces its protections.
11. The kill switch is off and no circuit breaker is active.
12. Reversibility, rollout, and observability meet the requirements of the change class.

**If any required condition is missing, unknown, or false → no auto-merge.**

### 6.2 Illustrative configuration

This YAML is a **policy sketch**, not a working file you can paste into GitHub Actions:

```yaml
mode: shadow                   # shadow | controlled | paused
automerge:
  enabled: false               # requires an explicit human decision
  tiers: [T3]                  # permitted by policy, not enabled
  allowed_change_classes: []  # empty until specific classes are approved
  trusted_identities: []      # populated after checking permissions
  require_independent_review: true
  require_security_evidence: true
  require_current_sha: true
  fail_closed: true
human_approvals:
  T3_eligible: 0
  T2_default: 1
  T1_default: 1
  T1_critical: 2
rollout:
  kill_switch: false
```

An empty list of eligible classes must prevent auto-merge even if someone changes `mode` by mistake. A real implementation needs policy evaluation in a required check and verified GitHub permissions.

### 6.3 Platform limitations

Don't assume CODEOWNERS enforces the policy by itself. Verify GitHub branch protection and rulesets, required approvals, bypass permissions, bot accounts, status checks, and merge queue against the actual repository configuration.

If the platform cannot express the tier matrix directly, use a **required status check** calculated by the controller from authorized evidence. Don't give a bot unrestricted bypass permissions as a substitute for policy.

## 7. Runbooks and rollback

### 7.1 Fail closed

Automatically suspend **eligibility for auto-merge** if any of these occur:

- Missing or failed CI, independent review, or security checks.
- Inconsistent SHA/base information.
- Failures involving identity, permissions, or policy retrieval.
- A material increase in incidents or reverts for an authorized change class.
- Loss of the ability to observe production behavior after a change.

Keep PRs available for human review; don't delete them.

### 7.2 Reverting changes

Every eligible change class must define detection, ownership, runbook, rollback mechanism, data handling, and post-revert confirmation. Feature flags can reduce the impact, but they don't automatically undo data changes or external effects.

Automatic rollback is safe only when the trigger, effect, and reversibility have actually been tested. Otherwise, block new merges and escalate the response.

### 7.3 Learn from incidents

For every material regression attributed to an agent-produced change:

1. Record the cause and timeline. Don't rely solely on the previous review verdict.
2. Identify the missing or ineffective gate.
3. Create a reproducible negative test.
4. Fix the lint rule, contract, instruction, or test where it makes the most sense.
5. Suspend the affected auto-merge class until the new check is validated.

## 8. Gradual rollout

| Phase | What changes | Acceptance evidence |
| --- | --- | --- |
| **0. Baseline** | Map rules, permissions, volume, incidents, and actual check coverage | Verifiable inventory; unknown risks documented |
| **1. Governance** | Protect instructions and gates; resolve conflicting policies | Protected-path tests; human review |
| **2. Navigable documentation** | Create an instructions index, criteria, real examples, and a legacy-pattern catalog | Valid references, actual gate status, no contradictory rules |
| **3. Reliable review** | Separate implementer/reviewer, validate verdicts and security | Contract, SHA, findings, and identity tests |
| **4. Shadow mode** | Simulate auto-merge authorization **without merging** | Disagreements with human decisions analyzed |
| **5. Controlled T3** | Approve one or a few T3 change classes after humans approve the policy | Gates, GitHub, rollback, and telemetry tested |
| **6. T3 expansion** | Expand only to classes with sufficient history | No unacceptable increase in incidents/reverts |
| **7. Selective T2** | Evaluate waiving individual human approval by change class | Demonstrated safety, reliability, and accountability |
| **8. Continuous reassessment** | Adjust rules using incidents and measurements | Sustained reduction in human time without quality degradation |

**Don't set a mandatory auto-merge percentage.** Set operational limits and measure the consequences. New change categories should run in shadow mode before they become eligible.

## 9. System acceptance tests

These are proposed test specifications. They have not been executed simply because they're listed in this plan.

| ID | Scenario | Expected result |
| --- | --- | --- |
| AT-01 | Agent builds a small feature with tests | Follows conventions and provides actual evidence |
| AT-02 | Agent builds a UI that accesses an API | Preserves contracts and separates testable logic |
| AT-03 | Reviewer receives a deliberate authorization violation | Blocking finding with evidence; does not approve |
| AT-04 | Agent attempts to modify its own review policy | PR is excluded from autonomous flow; human governance required |
| AT-05 | Authorized T3 PR passes all required gates | Merges without human approval after final validation |
| AT-06 | T3 PR has no available security review | Does not auto-merge |
| AT-07 | T2 PR without an approved exemption attempts auto-merge | Requires one valid human approval |
| AT-08 | T1 PR declares itself T3 | Computed tier prevails; autonomous merge blocked |
| AT-09 | New commit arrives after review | Previous evidence is invalidated |
| AT-10 | Same agent implements and reviews | Independence check fails when required |
| AT-11 | Checklist has duplicate or missing criteria | Verdict rejected; no valid quality score |
| AT-12 | Checklist marks every criterion N/A | Explicit human escalation |
| AT-13 | Reviewers repeatedly report the same findings | Review-round limit and escalation |
| AT-14 | Required check fails or disappears | Auto-merge blocked |
| AT-15 | Unauthorized account attempts to merge | Permission denied / gate blocks |
| AT-16 | Kill switch is activated | No new auto-merges |
| AT-17 | PR changes a localized instruction file | Governance protection applies regardless of declared tier |
| AT-18 | Simulated incident after merge | Change class suspended, evidence logged, incident response executed |

To compare progress, repeat the same tasks under controlled conditions with identical prompts, inputs, and criteria. Record commands, results, policy version, and SHA. Don't claim the project achieved outcomes that haven't been tested.

## 10. Metrics and expansion criteria

Measure by tier, change category, and agent identity:

- Percentage of PRs merged without human intervention.
- Human minutes per PR and per change shipped without regression.
- Number of human approvals and comments per PR.
- Time in queue between PR ready and merge.
- Number and cost of review rounds between agents.
- Percentage of reverts and incidents attributable to the change.
- Detection, mitigation, and recovery time for regressions.
- False-positive findings and problems missed by reviewers.
- Percentage of PRs blocked by a gate, including reasons.

**Primary metric:** correct changes shipped per human hour. **Guardrails:** incidents, reverts, downtime, data exposure, and rework cost. Without a baseline, there is no honest comparison.

Expansion requires human judgment about the data and sample quality. Don't automate it just because an arbitrary percentage was reached.

## 11. Documentation and approved examples

Agents tend to reuse the code they find. The repository should tell them explicitly what to copy and what not to copy:

- A short `AGENTS.md` points to specific rules, commands, and responsibilities.
- Architecture references link to **real, reviewed files** in the project, with: *what to copy*, *what not to copy*, *evidence*, and *when the reference becomes invalid*.
- A legacy catalog identifies specific problematic characteristics. It doesn't condemn a file solely because it's old or long.
- Changes to a referenced file trigger a review of its corresponding reference entry.
- Test instructions for each tool. Don't assume every agent reads or imports the same files.
- Each rule must say whether it's enforced by CI, only in agent PRs, in local hooks, or through manual review.

### 11.1 Lint debt

A new rule that would fail existing code must be adopted gradually. For example, prohibit new non-null assertions in clean directories while addressing existing assertions module by module, with tests. Any exception needs a verifiable reason, and partial coverage must be documented. The same applies to unused locals, unsafe casts, and forbidden imports.

Don't call a gate active until you've verified its behavior in CI with the project's actual code and tool versions.

## 12. Decisions that remain human

More autonomy doesn't transfer all product and operational responsibility to AI. Depending on the context, human approval remains necessary for pricing or contract changes, materially consequential business decisions, ambiguous business rules, security exceptions, destructive migrations, access policies, tier redefinitions, and expansions of permissions.

AI can research, compare options, propose changes, and implement authorized approaches. It should not independently decide what residual risk the business accepts.

## 13. Checklist before enabling auto-merge

- [ ] The classifier examines touched files, renames, added/removed content, and likely impact.
- [ ] Human owners have approved and versioned the policy.
- [ ] Normative instructions and gate scripts are protected.
- [ ] CI and security checks are actually running.
- [ ] The independent reviewer has been tested on positive and negative cases.
- [ ] The review contract validates data, checklist, and quality score without blindly trusting the LLM.
- [ ] Evidence is invalidated when HEAD or base changes require revalidation.
- [ ] Actual GitHub permissions and bypass paths have been audited.
- [ ] The change class is explicitly eligible.
- [ ] The merge account has least-privilege access and cannot bypass rulesets.
- [ ] Telemetry and a rollback runbook are operational.
- [ ] The kill switch and per-class suspension mechanisms have been exercised.
- [ ] Shadow-mode decisions have been compared with human outcomes.
- [ ] A human is accountable for policy, exceptions, and incidents.

**If a condition is required for the class and hasn't been verified, don't enable auto-merge.**

## 14. What every adoption still needs to validate

This document **does not** verify any particular repository's branch protection, bot permissions, CI coverage, review models, merge-queue availability, policy criteria, production metrics, risk thresholds, or rollback capability.

Implementation starts with a verifiable assessment of the existing infrastructure. Keep the solution smaller than the problem, and prefer tools the team already operates.

## 15. References

- Anthropic, [How the Claude Code team does code review](https://claude.dev/blog/solving-code-review-at-anthropic/), October 15, 2026 — layered reviews, human time, risk matrices, rollback.
- Anthropic, [Redesigning source control at Anthropic](https://www.anthropic.com/research/redesigning-source-control), October 13, 2026 — infrastructure bottlenecks and integration at scale. **Not** a recommendation for small teams to replace Git.
- OpenAI, [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/), February 11, 2026 — agent-readable environments, verifiable code, documentation as a map.

**Attribution:** those companies' published principles informed parts of this proposal. The tiers, checks, rollout stages, and controls described here are an independent adaptation, not an official handbook from any of those companies.