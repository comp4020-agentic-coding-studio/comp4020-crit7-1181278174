# Process overview

## What I built

A semester planner for ANU computing courses: courses go into semesters, and
each one is checked against its prerequisites, the semesters it runs in each
year, incompatible courses and the 24-unit load, with the Programs and Courses
(P&C) text behind every warning. `README.md` says what good means here.

## The moments that mattered

### Research before design

I chose course planning over tutorial allocation because its data is public:
the agent could read it from P&C instead of my typing it in. Before accepting
a design I asked for evidence:

> 你先调研一下，现在的学生都有什么痛点，然后给我一个详细的设计方案
> (First research what students struggle with now, then give me a detailed design.)

The research found student-made planners that already do more than one night
allows. I therefore set the aim as trust rather than features: every warning
cites its source, offerings are read per year, and whatever cannot be checked
is stated ([`d7b317f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-1181278174/commit/d7b317f)).

### Holding the rules to P&C's words

My harness forbids any rule the P&C sentence does not state
([`ecb4dfb`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-1181278174/commit/ecb4dfb)).
The rules were read one course at a time, and a test compares each rule with
its sentence in both directions; it failed when a prerequisite absent from the
text was added on purpose
([`f2691a8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-1181278174/commit/f2691a8)).
The database refuses what a plan must never contain, through constraints and
triggers rather than application code alone
([`a9f8870`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-1181278174/commit/a9f8870)).

### Checking what shipped

Each new test was shown failing before it was trusted. The deployed site
passed the checks CI runs after a deploy, and screenshots at 390 px exposed a
style conflict the tests could not see
([`9f06677`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-1181278174/commit/9f06677)).
