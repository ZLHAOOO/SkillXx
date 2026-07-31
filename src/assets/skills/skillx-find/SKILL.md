---
name: skillx-find
description: Searches the local SkillX library (~/.skillx/skills/) and loads a matching skill into context. Use this skill when the user asks for a specialized capability that might exist as a SkillX skill, or when they explicitly say "find a skill" / "查个 skill" / "skillx-find" / "用 SkillX 找一下" / "SkillX 库里有没有 X" / "看看我有没有相关的 skill".
version: 1.0.0
author: SkillX
license: MIT
---

# SkillX Find

Search the user's local SkillX library for a relevant skill, and load it into your
context so you can use it on the current task.

The SkillX app keeps every skill the user owns in a central **hub directory**, and
symlinks only the *enabled* ones into each agent's config folder. The hub itself
is the complete catalog — it contains skills that may not be linked to this agent
right now. This skill teaches you how to query that hub with your native file tools,
so you can discover specialized skills **on demand** instead of guessing from the
small subset that happens to be linked to you.

## When to Use This Skill

Invoke this skill when any of the following is true:

- The user says something like "find a skill for X" / "查个 skill" / "skillx-find" /
  "用 SkillX 找一下" / "SkillX 库里有没有 X" / "看看我有没有相关的 skill"
- The user asks for a specialized capability (deploy, design, translate, OCR,
  video edit, etc.) and you don't see a matching skill in your currently loaded list
- The user explicitly mentions SkillX, the skill library, or "look in my skills"
- You're about to do something niche and want to check whether the user has a skill
  for it before improvising

**Do NOT** invoke for tasks you can already do with your default tools. This is for
genuine "I might be missing a specialized skill" moments, not routine work.

## Where the Library Lives

The SkillX hub is at:

| Platform       | Path                                  |
| -------------- | ------------------------------------- |
| macOS / Linux  | `$HOME/.skillx/skills/`               |
| Windows        | `%USERPROFILE%\.skillx\skills\`       |

Each skill is a subdirectory containing a `SKILL.md` file. The frontmatter has
`name:` and `description:`; the body has the actual instructions.

If the path is unclear, resolve it via shell:

```bash
# macOS / Linux
echo "$HOME/.skillx/skills"

# Windows (PowerShell)
echo $env:USERPROFILE\.skillx\skills
```

## Search Workflow

### Step 1 — Enumerate the library

Use `Glob` (or `find`) to list every `SKILL.md` in the hub:

```
~/.skillx/skills/*/SKILL.md
```

This gives you the rough size of the library and the slug of every skill.

### Step 2 — Narrow by name, description, and content

Use `Grep` to find skills whose frontmatter matches the user's need. The pattern
below hits `name:` and `description:` in one pass:

```
Grep pattern="^name:|^description:" path="~/.skillx/skills" glob="**/SKILL.md"
```

For natural-language queries, **also grep the SKILL.md body** for the most distinctive
keywords. Body content often names the tool, API, or workflow the skill targets —
that's a stronger signal than the description alone.

If a query returns too many candidates, narrow by adding a more specific term
(e.g., "deploy kubernetes" instead of just "deploy").

### Step 3 — Inspect the top candidates

For each promising match, `Read` the first ~30 lines of its `SKILL.md` to see the
full description and any prerequisites. Pick the best fit, or shortlist 2–3 if
ambiguous.

### Step 4 — Load and use

`Read` the full `SKILL.md` of the chosen skill. Once the content is in context,
**treat it as an active skill**: follow its instructions, honor its prerequisites,
and apply its workflow to the user's request. Do not re-summarize or paraphrase
the loaded skill — use it directly.

## Decision Heuristics

- **No match at all** → tell the user no relevant skill was found in the library;
  offer to help directly with your general capabilities, and suggest adding a skill
  to SkillX if it's something they do often.
- **One strong match** → load it immediately and proceed with the task.
- **Several plausible matches** → present a short list (name + one-line summary)
  and let the user pick, then load the chosen one.
- **Match requires prerequisites the user may not have** (API keys, CLIs, env vars)
  → surface the requirement before starting the work so the user can decide.
- **Match is not currently linked to this agent** → that's fine. `Read` works on
  any file in the hub, even without a symlink. The skill becomes usable the moment
  you finish reading it.

## Fallback When Grep Is Unavailable

If your environment doesn't expose `Grep`, fall back to `Bash` + `grep`:

```bash
# Find SKILL.md files whose name or description matches a keyword
grep -lE "^name:.*<kw>|^description:.*<kw>" ~/.skillx/skills/*/SKILL.md
```

Or, for small libraries, `Glob` + `Read` with a `limit: 20` on each `SKILL.md` to
scan just the frontmatter.

## Example: "Can you help me convert a PDF to Markdown?"

1. Trigger phrase detected → invoke `skillx-find`.
2. `Glob ~/.skillx/skills/*/SKILL.md` → list of slugs.
3. `Grep` for "pdf" and "markdown" across both frontmatter and body.
4. Find e.g. `pdf-to-md` → read its first 30 lines to confirm fit.
5. `Read` the full `SKILL.md`, follow its instructions, do the work.

## Limitations

- **Performance**: `Grep` across hundreds of `SKILL.md` files is fast for <500 skills;
  at 1k+ it may add a few seconds. If this becomes a problem, ask the user to enable
  an indexed-search option in the SkillX app.
- **Keyword-based**: no semantic / embedding search here. If a query returns nothing,
  suggest the user rephrase with different keywords, or improve the skill's
  `description` field in SkillX.
- **Read-only**: this skill searches and reads. It does not install, enable, link,
  or modify anything. If the user wants a skill permanently enabled for this agent,
  they should toggle it in the SkillX app's Skills page.
- **No auto-trigger**: this skill is opt-in. You must decide to invoke it based on
  the user's request — there's no automatic discovery of the hub.

## Notes

- The hub path is the same regardless of which agent you're running in (Claude Code,
  Codex, Cline, Cursor, etc.) — only the path syntax differs.
- This skill assumes SkillX has been initialized on the user's machine. If
  `~/.skillx/skills/` is missing, tell the user the library is empty or SkillX
  hasn't been set up yet, and point them to the welcome flow.
- Skills with richer, more descriptive bodies are easier to find via this workflow.
  Encourage the user to keep their `SKILL.md` content well-written.
