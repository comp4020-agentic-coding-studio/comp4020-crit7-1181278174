# Plan: a semester planner for ANU computing courses

Crit 7 brief: build the ANU system you wish existed. Cutoff Wednesday 30
September 2026, 08:30.

## The problem

To plan the next few semesters at ANU you open one Programs and Courses (P&C)
page per course, read its prerequisite sentence, check which semester it runs
in which year, and keep track of all of it yourself. Nothing checks the plan as
a whole. ANUHub (ISIS, renamed on 26 May 2025) enrols you in courses; P&C is a
catalogue; ANU's own advice is "Identify courses with prerequisites and plan
accordingly" ([Stay on track](https://systems.anu.edu.au/students/continuing/stay-on-track)).

What students say (quotes read from an archive of r/ANU; check against the
posts before quoting them anywhere public):

- courses they need are not running that semester
  ([2026-07](https://www.reddit.com/r/Anu/comments/1urj0gz/need_advice_not_running_the_courses_i_need/)),
  and P&C calls future offerings "indicative only"
- first-year COMP prerequisites: "the handbook and enrolment options make it
  look like there are multiple pathways when there clearly aren't"
  ([2025-12](https://www.reddit.com/r/Anu/comments/1plh2sr/anu_level_1_comp_courses_prerequisites_make_zero/))
- after failing a course, working out which later courses it blocks
  ([2026-07](https://www.reddit.com/r/Anu/comments/1uqmgfi/feeling_completely_lost_after_failing_finm7006/))
- permission codes are slow
  ([2026-01](https://www.reddit.com/r/Anu/comments/1qh5h98/pls_help_me_with_enrolment/))

What the data shows (P&C, read on 30 September 2026):

- 12 of the 61 undergraduate COMP courses run in different semesters across
  2026, 2027 and 2028 (COMP4045 goes S2, S1, S2; COMP4600 and COMP4712 have no
  offering planned after 2026)
- 31 of them state a rule as "N units of ..." that has to be counted by hand
- COMP2100 is named as a prerequisite by 10 other courses
- a student can self-enrol in at most 24 units a semester
  ([Overload your enrolment](https://www.anu.edu.au/students/program-administration/enrolment/overload-your-enrolment))

Tools that exist: Coursemap and unidegreeplanner (student-made, ANU), Unidash,
UNSW's Circles, Melbourne's My Course Planner. Coursemap does more than this
prototype will. What this one does differently is below.

## What good looks like here

- Every warning shows its evidence: the reason, the P&C sentence it comes from,
  the page link and the date it was read.
- Offerings are read per year, 2026 to 2028, from each course page's class
  tab. 2027 and 2028 are marked indicative. Later years say "not published";
  the app does not guess from an earlier year.
- Rules like "12 units of 2000-level COMP" are counted.
- Conditions the app cannot check (permission codes, program enrolment, WAM)
  are shown as "check yourself" with the original text. They never pass or fail
  silently.
- A plan is saved on the server, opens from its link on any device, and a
  change on one device shows on the others.
- Everything works at 390 px wide and without JavaScript.

## Not building

Degree and major requirements; summer and winter sessions; grades and WAM;
timetables and tutorials; logins; drag and drop (forms instead, which work on a
phone, with a keyboard and without JavaScript); importing from ANUHub.

## Data

- `scripts/fetch-catalogue.ts` writes `data/catalogue.json`: 71 courses (the
  undergraduate COMP courses, plus MATH1003, MATH1005, MATH1013, MATH1014,
  MATH1113, MATH1115, MATH1116, ENGN2219, ENGN2228, ENGN3539 and INFS1001,
  which their prerequisites name). COMP5920, the exchange program, is left
  out: its unit value is "6 to 24 units" and it is not a course you place in a
  semester (decided 30 September). For each course: code, title, units, the
  requisite text as P&C prints it, offerings for 2026 to 2028, source URL and
  the time it was read. It waits at least half a second between requests and
  sends a User-Agent naming only the project. The method follows the notes in
  [smcclab/anu-pandc](https://github.com/smcclab/anu-pandc/blob/main/docs/reading-pandc-directly.md):
  the class tab, not the search API's `Session` field, says when a course runs.
- `data/requisites.json` is the requisite text read into rules, by hand, one
  course at a time. A rule is a list of groups; every group must be met; a
  group is met by any one of its options. An option is a course (optionally
  allowed in the same semester) or "N units" filtered by subject, level and
  excluded codes. Each entry also lists incompatible courses, what is left to
  check by hand, and how an ambiguous sentence was read.

## Schema (Drizzle, SQLite)

| table | columns |
|---|---|
| `courses` | `code` PK, `title`, `units`, `subject`, `level`, `requisite_text`, `reading_note`, `manual_note`, `source_url`, `fetched_at` |
| `offerings` | (`course_code`, `year`, `session`) PK; session is `S1` or `S2` |
| `requisite_options` | `id`, `course_code`, `clause`, either `required_code` or (`min_units`, `subjects`, `levels`, `excluded`), `concurrent`; a CHECK allows only one of the two kinds |
| `incompatibilities` | (`course_code`, `other_code`) PK |
| `plans` | `id` (random, 12 characters), `name`, `start_year`, `start_session`, `term_count`, `last_change`, `created_at`, `updated_at` |
| `plan_courses` | (`plan_id`, `course_code`) PK, `year`, `session`, `units`; a CHECK keeps codes to four capitals and four digits |

The first four tables are the catalogue, loaded from `data/` at startup in one
transaction that never touches plans. The last two hold what people make. A
course outside the catalogue can go in a plan: its units count, and it is
marked as not checked.

## Checks

One pure function, `checkPlan(plan, catalogue)`, returns the problems for each
placed course and a summary for each semester.

- Prerequisites: each group has an option placed in an earlier semester (or
  the same semester where the text allows it); unit options add up the units
  of earlier courses that match.
- Offered: semesters up to 2026 S2 count as done and are not checked; 2027 and
  2028 use the class-tab data; later years are "not published".
- Incompatible: another course in the plan that P&C lists as incompatible.
- Load: more than 24 units in a semester.
- Hint: for a missing prerequisite course, the earlier semesters it runs in.
- Eligible: courses not yet in the plan that run that semester and whose rules
  are met.

## Pages

- `/`: what this is, a form to start a plan, a link to the example plan.
- `/plans/[id]`: one card per semester (years as rows with two columns on a
  wide screen, one column on a phone). Each course shows its status and
  reasons, with Move and Remove. Each card has an Add form and a collapsed
  list of courses the student could take that semester. The top shows the
  plan's totals and what the last change did.
- `/courses/` and `/courses/[code]`: offerings by year, the P&C text beside the
  rule read from it, what is left to check by hand, incompatible courses, which
  courses it leads to, and the source link and date.
- `/plans/example`: a read-only plan with two problems in it, and a button to
  copy it.
- `/api/events`: when a plan changes, pages showing that plan reload.

## Tests (`spec/`)

- a plan and its courses survive a reload (brief: "the core flow persists")
- the rules as the page shows them: a missing prerequisite, a course in a
  semester it doesn't run, incompatible courses, a semester over 24 units, a
  duplicate course refused, the example plan refusing changes
- `checkPlan` itself: unit counting, excluded codes, same-semester
  prerequisites
- the data: every course code in a rule appears in that course's P&C text;
  every COMP course has an entry; offerings are only S1 or S2 of 2026 to 2028;
  every course has a source link
- a change to a plan is sent on `/api/events`
- `spec/routes.ts` covers every page type

## Order of work

1. data: fetch script, catalogue, rules, data tests
2. schema, migration and catalogue loading; the guestbook goes, the event
   stream stays
3. `checkPlan`, the plan page with add, move and remove, and their tests
4. first deploy by hand, check at 390 px
5. course pages, eligible lists, example plan, live updates
6. README, PROCESS.md, reflection; ship by 07:30

If time runs short, drop these in order: the hint, the last-change summary, the
course index, the eligible lists, the copy button. Persistence, checks with
reasons, the source on each course page, the tests and the deploy stay.
