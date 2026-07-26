---
name: inspire
description: Use to brainstorm new feature ideas for a project — surfacing a few directions worth exploring (up to 5), or developing an idea the user already brought, then deepening whichever they pick. Works from the project's PROJECT.md and BUSINESS.md when given them, or from a plain-text description of the project/ideas. It grounds ideas in the actual project (gaps, unused capabilities, tensions in what exists) rather than generic suggestions, presents a few at a time, and deepens only what the user latches onto. Saves a chosen, fleshed-out idea to docs/dev/ideas.md only on explicit confirmation. Trigger when the user wants to explore what to build next, generate feature ideas, or turn a rough hunch into a scoped direction.
---

# Inspire

## What this skill is (and is not)

Most skills in this set document or execute; they never invent. This one is the
deliberate exception alongside generate-theme: its job is to **generate ideas** for
what to build next. But generation is the cheap part — a model can list twenty
generic features from any project. The value is the opposite: **filtering out the
obvious and deepening the one worth pursuing.** So this skill is not a list-dumper.
It is an interactive partner that surfaces a few grounded directions, lets the user
kill the weak ones instantly, and drills into what they latch onto.

It does not decide the roadmap (that is the user's product judgment), does not plan
(that is writing-plans-front), and does not write code. Its deliverable is a chosen,
fleshed-out idea — optionally saved to `docs/dev/ideas.md`.

## Inputs

Ideas come from what the user passes at invocation:
- **PROJECT.md and/or BUSINESS.md** (ideal): ground ideas in the real project — its
  capabilities, business scenarios, known gaps, tech debt, and out-of-scope notes.
- **Plain text** (fallback): a description of the project or some rough hunches. Work
  from that.
If nothing is passed and no docs are found, ask the user to point to the docs or
describe the project in a sentence or two — do not ideate in a vacuum.

## The anti-slop principle

Generic ideas ("add dark mode", "add Excel export", "add notifications") are the
statistical-average features that fit any project and therefore serve none. Avoid
them. Ground every direction in something specific about THIS project.

When you have **PROJECT.md / BUSINESS.md**, the hooks are structural:
- a **gap** between an existing capability and a scenario it doesn't yet serve,
- an **unused or underused** capability that could do more,
- a **tension or weakness** already noted (tech debt, a known gap, a rough spot),
- an **out-of-scope** item worth reconsidering.

When you only have **plain text**, those sections don't exist — so hook onto what
the text actually gives you: the domain, the specific features or pains mentioned,
who it's for, what it notably lacks. Do not fall back to generic features just
because the input is thin; if the text is too thin to ground anything specific, ask
the user one or two questions to get real detail rather than inventing average
ideas.

If a direction would read the same for any project, it is slop — cut it.

## Process

### Step 0 — Load and understand
1. Read whatever the user passed (PROJECT.md/BUSINESS.md or text). Understand what
   the project does, who it serves, what exists, and where the gaps/tensions are.
   Do not start proposing until you have a grounded picture. If `docs/dev/ideas.md`
   exists, also read its `# Considered and dropped` section as **anti-memory**: these
   are directions already deepened and dropped for a stated reason — do not re-propose
   them as if fresh.

### Step 1 — Surface directions (the wide step) — or take the user's own
2. **If the user already brought their own idea or hunch** ("I want to add X but
   haven't scoped it"), skip generating directions — go straight to Step 2 and
   deepen theirs. Do not override their idea with your own list.
3. **Otherwise**, present **up to 5 directions worth exploring (hard limit — never
   more than 5)** — not finished features, directions with a reason. A long list is a
   failure of this skill, not helpfulness: the user cannot filter twenty ideas, and
   the whole point is that they react to a few and you deepen what they pick. If you
   have more than five candidates, pick the five most grounded and drop the rest.
   Each is one short paragraph: the direction, and what specific thing about the
   project makes it worth considering ("you have capability X and scenario Y but
   nothing connects them — a direction here could…"). Keep them grounded per the
   anti-slop principle. Do not re-propose a direction sitting in `# Considered and
   dropped`; if a live gap genuinely pulls back to one, you may raise it — but name the
   prior drop and its reason ("dropped before because X — still true?"), don't present
   it as new.
4. Then stop and let the user react. They may latch onto one, reject all, or ask for
   more. Rejected directions die immediately — do not defend them. If the user wants
   more, surface a fresh set (still ≤5), not the same ones reworded. A batch rejected
   here at the wide step is **not** recorded anywhere (see Step 3): no reason surfaced,
   so there is nothing honest to store.

### Step 2 — Deepen the one they pick (the narrow step)
5. When the user latches onto a direction, do NOT jump to new ideas — **drill into
   this one.** Explore concrete shapes it could take, trade-offs between them, rough
   boundaries (what's in, what's out), and what makes it valuable. This is where the
   value is; spend the effort here, iteratively, following the user's reactions.
6. Keep it a dialogue: propose, let the user steer, refine. Do not run away with it
   — the user's judgment leads on what's worth pursuing. When you offer to continue,
   offer only to **deepen the idea further** or to **save it to `docs/dev/ideas.md`**.
   Do NOT offer to plan it, design the implementation, or produce any other artifact
   — that is a different skill (`writing-plans-front`) invoked later; this skill's only
   file is `docs/dev/ideas.md`.

### Step 3 — Capture, only if chosen
7. When a direction is fleshed out, ask whether to save it to `docs/dev/ideas.md`.
   Save ONLY on an explicit yes. Not everything explored is worth keeping — some
   ideas get deepened and then dismissed, and that is fine; they are not saved as
   backlog.
8. On yes, append the idea to `docs/dev/ideas.md` under `# Project Ideas` (create the
   file if missing) as a self-contained entry (see shape). Do not overwrite or reorder
   existing entries.
9. **Capture a consciously dropped direction — only with a concrete reason.** If a
   direction was **deepened in Step 2** and then **consciously dropped**, and the
   dialogue produced a **concrete reason** for dropping it (too costly, architecturally
   premature, duplicates a neighbouring module, out of product focus, etc.), append a
   one-line entry to the `# Considered and dropped` section (see shape). The reason is
   taken from what was actually said while deepening — do NOT invent one, and do NOT ask
   the user for one just to fill the field.
   - **No reason → no entry.** If the direction was dropped without a concrete reason
     surfacing (e.g. the user rejected the whole batch at the wide step with a plain
     "not these / show me others"), record **nothing** — not the direction, not a
     placeholder reason. A rejected batch at Step 1 is "didn't land", not "considered
     and rejected"; storing it would bury a possibly-valid future idea on a passing mood.
   - This section is append-only like the backlog; never rewrite or remove existing
     dropped entries here.
10. Report what was saved (backlog entry, dropped entry, or nothing), and that a saved
   backlog idea can later feed `writing-plans-front` when the user decides to build it.

## ideas.md shape

`docs/dev/ideas.md` has two parts: a backlog of **chosen, fleshed-out** ideas, and a
compact **anti-memory** of directions that were deepened and consciously dropped with a
concrete reason. Neither is a dump of everything generated. Both are append-only.

```md
# Project Ideas

<Backlog of explored, kept ideas. Raw batch-rejections are not stored here — only the
Considered-and-dropped section below records dropped directions, and only with a reason.>

## <Idea name>
- Added: <YYYY-MM-DD — use today's real local date, e.g. via `date '+%Y-%m-%d'`, not a placeholder>
- The idea: <what it is, in a couple of plain sentences>
- Why it's worth it: <the specific project gap/need/tension it addresses — not generic>
- Rough scope: <what's in; what's explicitly out>
- Open questions: <anything unresolved, or "none">

# Considered and dropped

<One line per direction that was DEEPENED and then consciously dropped WITH a concrete
reason that surfaced in the dialogue. Not batch-rejections, not placeholder reasons.
This is anti-memory: inspire reads it at Step 0 so it does not re-propose a known
dead-end, or, if the same gap pulls there again, flags "dropped before because X — still
true?". No reason → no line.>

- <direction> — dropped <YYYY-MM-DD>: <the concrete reason, from what was actually said>
```

## Rules

- Ground ideas in the specific project; never emit generic features that would fit
  any project. If a direction isn't tied to something real in the inputs, cut it.
- Present a few directions at a time — never more than five — then wait for the
  user. Never dump a long list; the user's reaction is the filter that removes slop.
- Deepen what the user picks rather than generating more; the value is in developing
  one direction, not in volume of ideas.
- The user's product judgment leads. This skill proposes and explores; it does not
  decide what should be built or set a roadmap.
- Save a **backlog** idea to `docs/dev/ideas.md` only on explicit confirmation, and
  only when fleshed-out. Never auto-save a backlog idea.
- Record a **dropped** direction (in `# Considered and dropped`) only when it was
  deepened in Step 2 and consciously dropped **with a concrete reason that surfaced in
  the dialogue**. No reason → no entry. Never invent a reason, never ask for one just to
  fill the field, and never record a wide-step batch rejection (that is "didn't land",
  not "considered and dropped"). Half-formed directions are never stored in either part.
- `ideas.md` is written append-only: append backlog entries and dropped lines; never
  overwrite, reorder, or remove existing entries in either section.
- Do not plan (that is writing-plans-front), do not write code, do not touch PROJECT.md,
  BUSINESS.md, or DESIGN.md — the only file this skill may write is
  `docs/dev/ideas.md`, and only appending. `ideas.md` is this skill's sole-write
  resource; other skills may read it (e.g. as input to planning) but do not write it.
- This skill's only artifact is `docs/dev/ideas.md`. Do not create any other
  artifact — no code, no plans, no foreign files from other workflows.
- Never offer, as a next step, to plan or design the implementation. inspire explores
  and captures ideas; building comes later through `writing-plans-front`, invoked
  separately by the user.
- Do not run build/test commands or git write operations.
- Keep the dialogue bounded: drive toward a captured idea or a clean "nothing worth
  keeping this round", not an endless chat.

## Self-Review

Before ending, confirm:
1. Ideas were grounded in the actual inputs — structural hooks from the docs, or the
   real specifics of the provided text; no generic features, and thin input was
   met with a clarifying question rather than average ideas.
2. Either the user's own brought idea was deepened directly, or directions were
   offered — no more than five, the user reacting between; no long unfiltered dump.
3. The picked direction was deepened (shapes, trade-offs, scope) rather than swapped
   for new ideas, and the only next steps offered were "deepen further" or "save to
   ideas.md" — not planning, implementation design, or any foreign artifact.
4. Nothing was saved to the backlog without an explicit yes; only fleshed-out ideas
   were appended there, existing entries untouched. Any `# Considered and dropped` line
   was written only for a direction deepened and consciously dropped **with a concrete
   reason from the dialogue** — no invented reasons, no wide-step batch rejections, no
   placeholders; and `# Considered and dropped` was read at Step 0 so nothing there was
   re-proposed as fresh.
5. No file other than `docs/dev/ideas.md` was modified or proposed — no code, no
   plans, no build/test/git operations.

## Handoff

Report concisely:

> "Explored <N> directions; deepened <the chosen one / none>."
> "Saved to backlog: <idea name, or nothing this round>. Recorded as dropped: <direction + reason, or none>."
> "When you decide to build a backlog idea, it can feed `writing-plans-front`."