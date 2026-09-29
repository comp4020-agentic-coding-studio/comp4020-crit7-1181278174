# Process overview

## What I built

A planner for ANU computing courses. A student places courses in semesters, and
each placement is checked against its prerequisites, the semesters it runs in
each year, incompatible courses and the 24-unit load; every warning quotes the
Programs and Courses (P&C) sentence behind it. Beside the plan sit the
computing majors' requirements, compared with a plan, and a course map of what
each course needs and opens.

## How I worked

I planned first and directed an AI coding agent turn by turn. `PLAN.md` records
the design and each decision. `CLAUDE.md`, carried from assignment 2, is its
rule-book: P&C is the only source of course data, no rule may state what the
text does not, anything that cannot be checked is quoted, and every new test
must be seen failing before it can pass
([`ecb4dfb`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-1181278174/commit/ecb4dfb)).

## The moments that mattered

**1. I made trust the aim, not features.**
*What happened:* research I asked for found student-made planners that already
do more than one night allows.
*What I did instead:* every warning cites its source, offerings are read year by
year, and what cannot be checked is said.
*How I knew:* 12 of the 60 COMP courses run in different semesters across 2026
to 2028
([`d7b317f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-1181278174/commit/d7b317f)).

**2. I held the rules to P&C's words.**
*What happened:* requisites are prose, some of it ambiguous.
*What I did instead:* each sentence was read into a rule one course at a time,
and a test compares every rule with its sentence in both directions.
*How I knew:* a prerequisite added that the text does not state turned the test
red
([`f2691a8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-1181278174/commit/f2691a8)).

**3. I had the pages drawn before they were built.**
*What happened:* the first interface was plain, and it lacked two views I
wanted: what each major requires, and how courses lead to one another.
*What I did instead:* every page was drawn on a design canvas with real data
first. Drawing the map exposed a wrong line: COMP3310 still needs nothing once
COMP2100 is done, because COMP2100 is itself 2000-level COMP.
*How I knew:* a test now checks that line
([`b5929fd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-1181278174/commit/b5929fd)).

The deployed site passes 480 tests, the probes CI runs after a deploy and a
check of 163 links. The seen-failing rule caught a live-update test that could
not fail
([`0ee157d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-1181278174/commit/0ee157d)).
I have not tested live updates between two real browsers.
