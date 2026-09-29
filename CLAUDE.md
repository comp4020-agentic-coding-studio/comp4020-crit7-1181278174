# COMP4020 Crit 7 — a semester planner for ANU computing courses

A student puts courses into semesters; the app says, for each one, whether it can go
there and why, citing Programs and Courses (P&C). Astro server with SQLite (Drizzle),
deployed to Fly at https://comp4020-crit7-1181278174.fly.dev/.

**Cutoff: Wednesday 30 September 2026, 08:30.** By then: pushed, live at that URL,
`reflections/crit-7.md` in the repo, checks green. The sweep starts at 08:45 and a check
still running counts as red. Marked in Chrome at 1920×1080 and 390×844.

The design is `PLAN.md`. When this file and `PLAN.md` disagree, stop and ask.

## Commands

- `pnpm dev` — local server on 4321, database in `.data/`.
- `pnpm check` — `astro check`, build, then every `spec/*.test.ts` against the built
  server with a throwaway database. Run before every commit. CI runs the same once public.
- `pnpm check:evidence` — `PROCESS.md` template gone, commit citations resolve,
  `reflections/crit-7.md` present, this file present. Run before `/ship`.
- `node scripts/fetch-catalogue.ts` — reads P&C again into `data/catalogue.json`.
- `pnpm db:generate` — a migration from `src/lib/schema.ts`. Commit the migration with
  the schema change.
- Deploy by hand while the repo is private:
  `mise exec -- flyctl deploy --remote-only --ha=false -a comp4020-crit7-1181278174`.
- `/preflight` before `/ship`. `/ship` flips the repo public. That cannot be undone and
  only happens on my word.

## What is fixed and what is mine

Fixed, do not edit: `fly.toml`, `Dockerfile`, `.github/workflows/checks.yml`, the
`security` block in `astro.config.ts`, `spec/invariants.test.ts`, `spec/readme.test.ts`,
`spec/global-setup.ts`, `scripts/check-evidence*`.

Mine: `src/`, `data/`, `scripts/fetch-catalogue.ts`, `drizzle/`, my own `spec/*.test.ts`,
`spec/routes.ts`, `PLAN.md`, `README.md`, `PROCESS.md`, `reflections/`, this file.

## Working with me

The marked thing is my directing. A fix I never saw is not evidence.

- **One bounded task, then report.** Anything else you noticed goes under "next".
- **A red check you can explain in one sentence:** fix it and list it under "fixed
  silently". Anything else: stop, paste the failure, say what you think went wrong, offer
  (a) fix the code, (b) a rule here, (c) a tighter check, (d) throw the attempt away.
- **Two attempts, then stop.** Report what you tried, what you saw, what you now think.
- **Design decisions are mine.** More than one reasonable answer: at most two options
  with a recommendation, then wait. The decision goes into `PLAN.md` with the date.
- **The report ends with evidence:** commands and output, `git diff --numstat`, what you
  saw at 1920 and 390 (or "no UI yet"), what you did not verify, fixed silently, next.
- **Never quote me unless you are quoting me.**
- **Adding to this file:** after I corrected you on the same thing twice, or a check caught
  you unexpectedly. One commit per rule.

## The loop

1. **Explore** — read the relevant source and checks first.
2. **Plan** — the change, its boundary, how it will be verified.
3. **Implement** — one bounded change. A second change gets its own commit.
4. **Verify** — `git diff --numstat`; `pnpm check`; the page at both widths.

**"Done" is a claim**: it comes with what you ran, what it printed, and what you did not
verify. **A new test is shown failing first**: break what it guards, watch it go red, put
it back.

## Commits

- **One decision, one commit.** If a title needs "and", it is two commits.
- **Shape:** lowercase, `topic: what changed`, one line, under 60 characters. A second
  paragraph only when the reason is not obvious.
- **My voice.** The message says what changed in the repo, as I would say it, and nothing
  about how the change was made.
- **Plain words, English.** No adjectives like robust or comprehensive, no metaphors.
- `pnpm check` before each commit. A test red on purpose is named in the message.
- Push to `main` after each part unless I say hold.

Good: `data: requisite rules for the COMP courses`
Good: `plan: move a course between semesters`
Bad: `Implement comprehensive prerequisite validation engine`

## Rules for this app

### Data

- P&C is the only source for titles, units, requisites and offerings.
  `data/catalogue.json` is generated: never edit it by hand, run the fetch script.
- `data/requisites.json` is read from each course's P&C sentence, one course at a time.
  Every course code in a rule must appear in that course's requisite text (a spec test
  enforces it). Never add a condition the text does not state. Where a sentence is
  ambiguous, write how it was read in `reading` and list it for me.
- What the app cannot check goes into `manual` with the original words. It never passes
  or fails silently.
- Offerings are S1 and S2 of the years the class tab publishes (2026–2028). No year is
  guessed from another.
- Nothing personal in any request or file: no email or name in a User-Agent, no data about
  any student.

### Checks

- `checkPlan` alone decides every status. Pages and endpoints display what it returns.
- Every problem carries its kind, one sentence a student can act on, and its source (the
  P&C page or the ANU policy page).
- Problems warn, they do not block. The database refuses only a course twice in one plan,
  a malformed code, a semester outside the plan, and any change to the example plan.

### Server and pages

- Every page renders on the server per request. Nothing is prerendered: CI posts to `/`
  to prove Astro's origin check is on.
- Forms work without JavaScript: POST, then 303 back (Post/Redirect/Get). Scripts only add
  the live reload.
- `/api/events` keeps streaming: CI reads its first bytes after every deploy.
- Every new page type gets a route in `spec/routes.ts`. One `h1`, a `nav`, a label on
  every control, status never shown by colour alone.
- At 390 px: one column, no sideways scroll, tap targets at least 44 px.
- Internal links only to pages that exist; CI runs a link checker on the live site. A
  course code outside the catalogue is plain text.
- Every page is in English. Chinese stays in chat.

### Not in this prototype

Degree and major requirements, summer and winter sessions, grades, timetables, logins,
drag and drop, ANUHub import. If one seems needed, say so and stop.

## Facts about this repo that bite

An entry earns its place after it has cost time here. Shape: what is true, how it was
measured. Delete it when it stops being true.

### CI does nothing while the repo is private

Both jobs in `.github/workflows/checks.yml` carry `if: !github.event.repository.private`.
Until `/ship`, the local `pnpm check` is the only gate and deploys are by hand. Measured by
reading the workflow; the same fact held in A2.

### The Fly machine sleeps

`auto_stop_machines = "stop"`: the first request after a quiet spell waits for the machine
to start. Measured 2026-09-30 01:24: 3.97 s for the first response.
