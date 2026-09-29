# Semester planner for ANU computing courses

Put ANU computing courses into semesters and see, for each one, whether it can
go there and why not: prerequisites, the semesters it runs in each year,
courses it can't be combined with, and your load. Every warning quotes ANU
Programs and Courses (P&C) and links to the page it came from. Two views sit
beside the plan: the computing majors' requirements, marked with what your plan
already has, and a course map that shows what each course needs first and what
it opens. It is an unofficial student prototype, not an ANU system.

**Try it:** open the [example plan](https://comp4020-crit7-1181278174.fly.dev/plans/example). It has two problems in
it. Copy it, move a course, and watch what the page says changes. Then see
[Software Development against that plan](https://comp4020-crit7-1181278174.fly.dev/majors/SOFT-MAJ?plan=example),
or [COMP2100 on the course map](https://comp4020-crit7-1181278174.fly.dev/map/COMP2100).

## Why this

Planning the next few semesters at ANU means opening one P&C page per course,
reading its prerequisite sentence, checking which semester it runs in which
year, and keeping track of it all yourself. ANUHub enrols you; P&C is a
catalogue; ANU's advice is to
"[identify courses with prerequisites and plan accordingly](https://systems.anu.edu.au/students/continuing/stay-on-track)".
Students on r/ANU ask what to do when a course they need
[isn't running that semester](https://www.reddit.com/r/Anu/comments/1urj0gz/need_advice_not_running_the_courses_i_need/),
and find the
[first-year COMP prerequisites](https://www.reddit.com/r/Anu/comments/1plh2sr/anu_level_1_comp_courses_prerequisites_make_zero/)
hard to follow.

The data backs them up. Of the 60 undergraduate COMP courses, 12 run in
different semesters across 2026, 2027 and 2028 (COMP4712 has no offering
planned after 2026), and 23 of the 71 courses here have a rule counted in
units, like "12 units of 2000-level COMP".

## What good looks like here

Student-made planners already exist ([Coursemap](https://anucoursemap.vercel.app),
[unidegreeplanner](https://unidegreeplanner.com)), and UNSW's Circles and
Melbourne's My Course Planner show the shape: semesters as columns, a warning
where a course is placed, a list of what you could take. I decided this one
would be judged on whether you can **trust a warning**:

- **Every warning shows its evidence**: the reason, the P&C sentence, the page,
  and the date it was read. Each [course page](https://comp4020-crit7-1181278174.fly.dev/courses/COMP2100) sets the P&C
  text beside the rule read from it.
- **The rules are held to P&C's words.** Each requisite sentence was read into
  a rule by hand, one course at a time, not parsed by a program. Tests fail if a rule names a course the sentence doesn't, if
  the sentence names a course the rule ignores, or if a condition left to the
  student is not quoted word for word. Where a sentence is ambiguous, the
  course page says how it was read (15 courses).
- **Offerings are read per year** from each page's class tab, 2026 to 2028.
  Later years say "not published"; nothing is guessed from another year.
- **What can't be checked is said.** Permission codes, which degree you're in,
  marks: 20 courses have conditions like these, shown as "check yourself".
  They never pass or fail silently.
- **The plan lives on the server.** It survives a reload, opens from its link
  on any device, and every open copy updates when it changes. The database
  itself refuses a course twice, a malformed code, a semester outside the
  plan, and any change to the example.
- **Majors are shown, not judged.** The seven computing majors' lists are read
  from their P&C pages, and tests check every block and course line against
  that text. Compared with a plan, a major shows which listed courses the plan
  has; the whole-major rules, such as how many units may be 1000-level, stay in
  P&C's words.
- **The course map says only what the rules say.** Each course shows what it
  needs first, one level further back, and the courses that name it; for each
  of those, only what it still needs once this course is done.
- **It works on a phone and without JavaScript**: plain forms, one column at
  390 px.

The tests in `spec/` enforce the data rules for courses and majors, the checks
(a missing prerequisite, a semester a course doesn't run, incompatible courses,
more than 24 units), persistence, the refusals, the live updates, the course
map and the major comparison. The readings of ambiguous sentences, the wording
of each warning and the layout are judgement calls; the layout was drawn on a
design canvas before it was built.

## What I chose not to build

Deciding whether a degree or major is complete (the rules change with the year
you started, and a night is not enough to model them honestly); majors outside
computing; summer and winter sessions; grades and WAM; timetables; logins; drag
and drop; importing from ANUHub.

What I missed rather than chose: a plan does not record the student's degree.
Each degree requires different courses, and some prerequisites change with the
degree (COMP2100 asks more of Bachelor of Science students), so those
conditions stay as "check yourself". Postgraduate courses and degrees, such as
the Master of Computing, are not covered.

## Limits

A plan has no login: its address is its only key, and anyone with it can
change it. The catalogue was read from P&C on 30 September 2026 using the
2027 rules, following the notes in
[smcclab/anu-pandc](https://github.com/smcclab/anu-pandc). Check anything that
matters with P&C or ANU Student Hubs.
