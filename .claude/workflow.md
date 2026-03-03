# Feature Pipeline — Orchestration Playbook

This file is instructions **for the main Claude Code agent** (orchestrator).
Run this pipeline whenever the user provides feature input (file path or pasted text).

---

## Trigger

Any of:
- User says "here's my feature request" and pastes text
- User points to a file: "read /path/to/file" or drops a `.txt`/`.md` into the chat
- User says "I want to add..." or "let me ramble about..."

## Pipeline

```
[User input]
     │
     ▼
1. PRD Agent (opus)        → writes specs/<slug>.md
     │
     ▼
2. Create branch            git checkout -b feat/<slug>
     │
     ▼
3. Coding Agent (sonnet)   → implements spec, leaves changes unstaged
     │
     ▼
4. Sensitive check          grep for secrets/keys/tokens in changed files
     │
     ▼
5. Review Agent (sonnet)   → reads spec + git diff, produces verdict
     │
     ├── PASS → commit + report back to user
     │
     └── FAIL → extract critical issues
                    │
                    ▼
               6. Coding Agent (sonnet)  — fix pass (max 3 loops total)
                    │
                    ▼
               back to step 4
```

---

## Step-by-step

### Step 1 — PRD Agent

Read `.claude/agents/prd-agent.md` for the prompt template.

Substitute:
- `{{INPUT}}` = the raw user text / file contents
- `{{CONTEXT}}` = contents of `AGENTS.md`

Launch with:
```
Agent(subagent_type="general-purpose", model="opus",
      prompt=<filled prd-agent prompt>)
```

Agent output = spec markdown. Write it to `specs/<slug>.md`.
Parse `**Slug:**` from the output to get the slug.

If spec contains **Open Questions** that are not "None", stop and ask the user before continuing.

### Step 2 — Create branch

```bash
git checkout -b feat/<slug>
```

If branch already exists, check it out. Don't reset.

### Step 3 — Coding Agent

Read `.claude/agents/coding-agent.md` for the prompt template.

Substitute:
- `{{SPEC}}` = full contents of `specs/<slug>.md`
- `{{BRANCH}}` = `feat/<slug>`

Launch with:
```
Agent(subagent_type="general-purpose", model="sonnet",
      prompt=<filled coding-agent prompt>)
```

### Step 4 — Sensitive content check

Before review, run:
```bash
git diff main...HEAD -- '*.ts' '*.tsx' '*.js' '*.json' | grep -iE "(api[_-]?key|secret|password|token|bearer|private_key|credential)"
```

If anything found: STOP. Report to user. Do not proceed.

### Step 5 — Review Agent

Get the diff:
```bash
git diff main...HEAD
```

Read `.claude/agents/review-agent.md` for the prompt template.

Substitute:
- `{{SPEC}}` = full contents of `specs/<slug>.md`
- `{{DIFF}}` = git diff output

Launch with:
```
Agent(subagent_type="general-purpose", model="sonnet",
      prompt=<filled review-agent prompt>)
```

Append the review output to `specs/<slug>.md` under `## Review Round N`.

### Step 6 — On FAIL

Extract the **Critical issues** list from the review output.

Append to the coding agent prompt:
```
## Fix Required (Review Round N findings)

The following critical issues were found. Fix only these — do not change anything else:

<critical issues list>
```

Re-run coding agent. Increment loop counter.
After 3 failed loops, stop and report to user with the last review output.

### Step 7 — On PASS

```bash
git add -p   # stage only changed files, not specs/ unless user wants it
git commit -m "<type>(<scope>): <what> per spec specs/<slug>.md"
```

Report back to user:
- Feature name + branch
- Commit hash
- Link to spec file
- Any open assumptions from implementation

---

## Spec file format

Lives at `specs/<slug>.md`. Written by PRD agent, appended by review agent.

```
specs/
  river-x-feature.md
  another-feature.md
```

Specs are committed alongside implementation or separately — user's call.

---

## Model rationale

| Agent | Model | Why |
|---|---|---|
| PRD/Spec | opus | Best structured reasoning, catches ambiguity, writes precise criteria |
| Coding | sonnet | Best code generation, fast, cost-efficient for iteration |
| Review | sonnet | Strong analytical capability, sufficient for diff analysis |

---

## Abort conditions

Stop immediately and report to user if:
- PRD agent has unresolved Open Questions
- Sensitive content found in diff
- 3 review loops exhausted without PASS
- Coding agent reports it could NOT implement something
