# Crit 7 — Build the ANU system you wish existed

## The breakthrough

The work moved forward when I stopped asking for features and asked how a
student could trust a warning. The data showed why this mattered: twelve
undergraduate COMP courses change semester between 2026 and 2028, and every
prerequisite is a paragraph of prose. Holding each rule to the sentence it came
from, with a test that fails whenever a rule says more than the text, is what
made the planner worth using.

## What it changed

Two things went wrong, and both came from what I did not check.

First, the planner does not know which degree a student is in. I noticed only
after the pages were built, when I asked for a view of degree requirements and
saw that each degree requires different courses, and that some prerequisites
change with the degree: COMP2100, for instance, asks more of Bachelor of
Science students. The research I asked for described students in general, and
I never tested the design against my own situation. Next time I will state who
the user is, starting with myself, before the data model is fixed.

Second, a research agent I launched put my personal email address into the
User-Agent header of its requests to public websites. Nothing asked it to, and
nothing forbade it. I now tell every agent that works on the web what it must
not send, and I read its scripts before trusting their output.

Both lessons point the same way: an agent works from what it is given, and what
it is not told matters as much as what it is.
