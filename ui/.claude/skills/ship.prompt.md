---
name: ship
description: Stage all UI changes, commit, push branch and open a GitHub PR for the current Kredius feature branch
---

You are shipping a Kredius UI feature branch. Follow these steps in order.

## Step 1 — Verify state

Run from the repo root (`/Users/julvasquez/Documents/my-project/kredius`):

```bash
git branch --show-current
git status
git diff --stat
```

If the working tree is clean (nothing to commit), tell the user and STOP.

## Step 2 — Stage UI changes

Stage only files under `ui/`:

```bash
git add ui/
git status
```

Review what is staged. If any file looks suspicious (secrets, binaries, unrelated changes) flag it and ask the user before continuing.

## Step 3 — Build a commit message

- Look at `git log --oneline -5` to match the repo's commit style.
- Kredius uses conventional commits: `feat(ui): <short description>`.
- One-line subject, present tense, ≤72 chars.
- End with the attribution line:
  `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

## Step 4 — Commit

```bash
git commit -m "<message from step 3>"
```

## Step 5 — Push

```bash
git push -u origin <current-branch>
```

If push fails, show the error and STOP.

## Step 6 — Create PR

Use `gh pr create` targeting `main`:

```bash
gh pr create \
  --base main \
  --title "<same as commit subject, without the conventional-commit prefix>" \
  --body "$(cat <<'EOF'
## Summary
<bullet points from the staged diff>

## Test plan
- [ ] Dev server starts without errors
- [ ] Feature navigates correctly in browser
- [ ] No regressions on adjacent panels

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## Step 7 — Report

Print:
- Branch pushed
- PR URL
- Files changed (from `git show --stat HEAD`)
