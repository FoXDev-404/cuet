import type { StaticGuide } from "./types";

/**
 * The practice loop: attempt, review, log, adjust, retake. These guides are
 * written to be read between papers, not before the first one.
 */
export const PRACTICE_GUIDES: StaticGuide[] = [
  {
    slug: "cuet-ug-how-to-review-a-mock-test",
    title: "How to Review a CUET Mock Test (Step by Step)",
    description:
      "Most mock-test gains come after submission. Here is a 45-minute review routine that turns every wrong answer into a specific next practice action.",
    category: "practice",
    publishedAt: "2026-10-08",
    updatedAt: "2026-11-02",
    body: `A mock test produces two things: a score and a set of decisions. Most students look at the score, feel something, and move on to the next paper. The decisions are where the improvement lives.

Set aside 45 minutes after every timed paper. Not to re-read the whole paper — to find out why specific marks were lost and what you will do differently.

## Review within 24 hours

Review while the attempt is still fresh. If you wait a week, you will remember the answers you changed, but not the reason you hesitated. The hesitation is the data.

Use the result page to locate the wrong and skipped questions, then work through them in this order:

1. Questions you answered wrong.
2. Questions you skipped but could have attempted.
3. Questions you got right by guessing.

The third group matters because a lucky guess hides a gap. Mark it now, or it will reappear in a harder form later.

## Sort every error into one bucket

Give each lost mark exactly one cause:

- **Concept gap** — you did not know the idea or the method.
- **Process slip** — you knew it but misread, mis-signed, rushed or changed a correct answer.
- **Time pressure** — you could have solved it with more time.
- **Presentation or interface** — you mis-clicked, missed a palette state, or did not see an instruction.

If an error fits two buckets, choose the one that would have prevented the loss. A misread formula is a process slip even if the concept is also shaky; fix the reading habit first because it is cheaper.

## Re-solve without looking

Reading a solution feels like learning. Re-solving proves it. For each wrong question:

1. Cover the solution and the correct option.
2. Solve it again on paper.
3. Say the reason for each step out loud.
4. Only then check the answer.

If you cannot reproduce the solution, the error is a concept gap, not a careless mistake. That distinction changes what you study next.

## Find the pattern, not just the question

One wrong question is an event. Three wrong questions from the same unit are a pattern. Count errors by unit and by cause.

A useful summary after each paper is four lines:

- Unit that lost the most marks:
- Most common cause:
- The two questions I should have skipped:
- The one habit I will change in the next paper:

If the same unit tops the list twice in a row, stop taking full papers until you have drilled it. More papers will only repeat the diagnosis.

## Write two changes, not ten

A review that ends with a ten-point improvement plan usually ends with zero changes. Pick two behaviours for the next attempt. Examples:

- "I will read the last line of every question before looking at the options."
- "I will skip any calculation that needs more than two steps on the first pass."
- "I will check the palette before the final five minutes."

Two specific changes are testable. Ten vague intentions are not.

## Track the review, not just the score

After four or five papers, compare the review summaries. Are the same causes appearing? Is the "time pressure" bucket shrinking? Is accuracy improving while attempts stay stable?

The [error log guide](/blog/cuet-ug-error-log-guide) gives the one-page template for this. The [paper library](/mock-tests) has the timed attempts, and the [leaderboard](/leaderboard) shows where a first attempt stands. Neither number replaces the review.

A mock test is a diagnostic tool. The review is the treatment.`,
  },
  {
    slug: "cuet-ug-error-log-guide",
    title: "The CUET Error Log: A Simple Template That Works",
    description:
      "A one-page error log template for CUET preparation: what to record after each paper, how to tag the cause, and how to review it without re-reading everything.",
    category: "practice",
    publishedAt: "2026-10-15",
    updatedAt: "2026-11-02",
    body: `An error log is not a diary of every mistake. It is a short list of the mistakes that are likely to repeat, written in a form you can act on. A good log fits on one page per paper and takes fifteen minutes to fill.

The score tells you where you stand. The log tells you why.

## The four columns

Use a notebook or a spreadsheet with four columns:

1. **Question and unit** — enough detail to find it again, plus the subject unit.
2. **What I did** — the wrong option, the skipped question, or the guessed answer.
3. **Why it happened** — one of: concept gap, process slip, time pressure, interface.
4. **The fix** — the exact drill or habit for the next week.

The fourth column is the one most students omit. Without it, the log becomes a record of regret instead of a plan.

## Tag every error with one cause

One cause per row keeps the log honest. If you write "silly mistake, concept weak, time less", you have not diagnosed anything.

- **Concept gap:** you could not explain the underlying idea without the solution.
- **Process slip:** you knew the idea but misread, mis-signed, rushed or changed a correct answer.
- **Time pressure:** you knew the method but ran out of time.
- **Interface:** you lost the question in the palette, missed an instruction, or clicked the wrong option.

Tag the cause that, if removed, would have saved the mark. Then count the tags at the end of the paper. The largest bucket decides the next week's practice.

## Review weekly, not nightly

Do not re-read the log every night. Use it twice a week:

- **After each paper:** fill it in while the attempt is fresh.
- **Once a week:** read the last three papers together and look for repeats.

The weekly read is where patterns appear. One wrong answer about coordination compounds is noise. Four wrong answers about the same reaction is a signal.

## Turn the log into drills

Each "fix" should be a small, schedulable action:

- Concept gap → re-read the NCERT section and solve ten questions.
- Process slip → a five-question drill where you read the last line first.
- Time pressure → a timed set at 80% of the normal time.
- Interface → a short practice attempt where you use only the palette and keyboard.

A fix that cannot be scheduled is not a fix. "Be more careful" is a wish; "ten questions with the last line read first" is a drill.

## A sample entry

> Q14, Electrochemistry. Chose option B because I used the wrong sign for the electrode potential. Cause: process slip. Fix: write the half-reaction and the sign convention before calculating, for the next ten numericals.

Notice that the entry does not copy the full question. It records the smallest amount of context needed to recognise the pattern.

## Keep the log small

A log with fifty rows per paper will not be reviewed. Aim for five to ten rows: every wrong answer, every skipped question you could have attempted, and every lucky guess.

At the end of the month, archive the old pages. Keep only the summary: the top two units and the top two causes. Those are the inputs for the next month's plan.

The [mock review guide](/blog/cuet-ug-how-to-review-a-mock-test) explains the 45-minute routine around the log, and the [score plateau guide](/blog/cuet-ug-score-plateau-fix) shows what to change when the same causes keep appearing.`,
  },
  {
    slug: "cuet-ug-time-management-strategy",
    title: "CUET Time Management: A Section-by-Section Plan",
    description:
      "How to budget time in CUET without freezing: section clocks, the three-pass system, when to leave a question, and how to use the last ten minutes.",
    category: "practice",
    publishedAt: "2026-10-22",
    updatedAt: "2026-11-02",
    body: `Time management in CUET is not about moving faster. It is about deciding earlier. The candidate who finishes calmly is usually not the fastest reader; they are the one who leaves a question before it becomes expensive.

The exam gives each section its own clock. That changes the maths: a strong section cannot lend time to a weak one. You need a plan for each section, not one plan for the whole paper.

## Start with the section clock

Before the exam, write down the number of questions and the time limit for each section from the official instructions. Divide the time by the questions to get a rough per-question budget.

Do not treat that number as a target for every question. Some questions are ten-second recalls; others need a minute. The average is only a warning line: if you are far above it, you are spending too long.

Check the section timer at every palette visit. A single glance prevents the classic disaster of discovering ten minutes before the end that one section is untouched.

## The three-pass system

- **First pass — collect easy marks.** Answer every question you recognise immediately. Do not stop to verify an answer you are confident about.
- **Second pass — thinkable questions.** Return to flagged questions where you can eliminate at least one option. Give each a hard limit of about a minute.
- **Third pass — deliberate decisions.** Sweep the palette for unanswered questions. Attempt or skip each one consciously; never leave a question because you did not see it.

The first pass builds momentum and protects the marks you already know. The second pass is where most of the remaining marks are. The third pass is where careless losses are prevented.

## Set a question cap

A useful rule for the second pass: if a question needs more than two steps of calculation, or more than one re-read, flag it and move on. You can return after the easier marks are secured.

This is not defeat. Every question carries the same marks, so a hard question that eats four minutes is worse than three easy questions answered in the same time.

## The last ten minutes

The last ten minutes are not for starting a new passage or a long calculation. They are for:

- sweeping the palette for unanswered questions;
- checking that your chosen options are registered;
- reviewing flagged questions with a clear yes-or-no decision;
- making sure you have not left a section unopened.

If you finish early, do not submit immediately. Use the remaining time to check the questions you marked as uncertain, not to re-solve everything.

## Practise the clock, not just the content

A timed paper is a different skill from an untimed worksheet. Practise with the section clock visible and with a rule for leaving questions. The [paper library](/mock-tests) runs the same interface and marking scheme, so the timing habit transfers.

After each attempt, note the section where you spent the most time and the section where you lost the most marks. They are often different, and that difference is the lesson.

For the structure behind the clocks, read the [exam pattern page](/cuet-ug-exam-pattern). For the attempt-or-skip arithmetic, the [accuracy guide](/blog/cuet-ug-accuracy-vs-attempts) explains when a guess is worth taking.`,
  },
  {
    slug: "cuet-ug-accuracy-vs-attempts",
    title: "CUET Accuracy vs Attempts: How Many to Answer",
    description:
      "More attempts do not always mean a higher CUET score. Use accuracy bands and expected value to decide when to answer, guess or leave a question blank.",
    category: "practice",
    publishedAt: "2026-10-29",
    updatedAt: "2026-11-02",
    body: `Every CUET season produces the same argument: is it better to attempt 50 questions with 70% accuracy or 40 questions with 85% accuracy? The arithmetic gives a clear answer, and it is not the one most students expect.

The marking rule is +5 for a correct answer and −1 for a wrong one. An unattempted question scores zero. Once you put those three numbers together, attempt count stops being a goal and becomes a by-product of accuracy.

## The arithmetic in one line

Score = (correct × 5) − (wrong × 1).

The 50-at-70% candidate gets 35 correct and 15 wrong: 175 − 15 = **160**.
The 40-at-85% candidate gets 34 correct and 6 wrong: 170 − 6 = **164**.

The second candidate answered ten fewer questions and scored more. Accuracy is not a personality trait; it is a scoring lever.

## Accuracy bands

Use your last three papers to estimate your accuracy in each section. Then apply a simple band:

- **Above 80%** — you can afford to attempt more. Look for questions you skipped too quickly.
- **65–80%** — the productive zone. Improve accuracy before pushing attempts.
- **Below 65%** — attempts are outrunning knowledge. Reduce blind guesses and review the causes.

The band is section-specific. It is normal to be at 85% in one subject and 60% in another. The weaker section needs drills, not more guesses.

## When a guess is worth it

A blind guess among four options has an expected value of about +0.2 marks: one chance of +5 against three chances of −1. That is barely positive, and the variance is high.

The picture changes when you can eliminate options:

- Eliminate one option: expected value is about +1.5.
- Eliminate two options: expected value is about +2.8.

So the rule is not "never guess". It is "guess only when you have eliminated something". If you cannot rule out a single option, a flagged skip is usually the better decision.

## How to raise attempts without losing accuracy

Do not start by guessing more. Start by finding the questions you skipped despite knowing the answer.

After a paper, count the skipped questions you could have solved with another thirty seconds. That number is your free attempt pool. Most students have five to ten of them.

Then improve recognition speed:

- Drill definitions and formulas until recall is instant.
- Practise scanning a question for the tested concept before reading every option.
- Use the first pass to collect easy marks instead of verifying them repeatedly.

## A target for the next paper

Pick one section and set two numbers: a minimum accuracy and a minimum attempt count. For example, "at least 80% accuracy and at least 30 attempts". If accuracy falls below the floor, stop increasing attempts and review.

Track both numbers in the [error log](/blog/cuet-ug-error-log-guide). A rising attempt count with falling accuracy is a warning, not progress.

The [marking scheme guide](/cuet-ug-marking-scheme) has the full rules, and the [domain paper guide](/blog/cuet-ug-domain-paper-structure) explains how the marking changes section strategy. The [paper library](/mock-tests) is where you test the numbers under a real clock.`,
  },
  {
    slug: "cuet-ug-first-mock-test-guide",
    title: "Your First CUET Mock Test: A Step-by-Step Guide",
    description:
      "New to CUET mocks? Here is how to choose a first paper, set up a distraction-free attempt, read the result page, and turn the score into a two-week plan.",
    category: "practice",
    publishedAt: "2026-11-05",
    updatedAt: "2026-11-05",
    body: `The first mock test is not a judgement. It is a calibration. You are finding out how the interface feels, how long the sections take, and which topics disappear under a clock. Treat it as data collection, not a verdict.

Here is a sequence that keeps the first attempt useful.

## Choose a paper you can finish

Pick a previous-year paper from a subject you have studied, preferably a recent shift. Do not choose the hardest paper to "see where you stand"; a paper far beyond your preparation produces noise, not a baseline.

The [previous-year library](/mock-tests) filters by subject and year. A recent paper in your strongest subject is a good first attempt because it lets you learn the interface without fighting the content at the same time.

## Set the conditions before the clock

- Use a laptop or desktop if possible; the palette and timer are easier to read.
- Close other tabs, mute notifications and keep your phone out of reach.
- Keep rough paper and a pen ready.
- Decide the start time and do not pause the clock.

The attempt should feel like the exam, not like a worksheet with a timer in the corner. Ten minutes of setup protects the value of the next hour.

## Use the interface properly

Read the instruction screen. Note how the palette colours work, how to mark a question for review, and how to move between sections. If the interface offers a question paper view or a calculator, find it before the first question.

Answer the questions you know first. Flag the ones you want to revisit. Do not spend the first ten minutes trying to prove you can solve the hardest question.

## Read the result page in this order

1. **Score and accuracy** — the headline, but not the whole story.
2. **Section-wise performance** — where the marks actually went.
3. **Time per section** — whether the clock or the content was the constraint.
4. **Wrong and skipped questions** — the raw material for the review.

Do not compare your first score with a friend's tenth score. Compare it with your own next attempt.

## Build a two-week plan

After the review, choose two priorities:

- One subject or unit that lost the most marks.
- One habit that cost marks across sections, such as guessing without elimination or ignoring the palette.

Spend the next two weeks on those two things. Take one more full paper at the end of the fortnight and compare the same four result-page numbers.

## What not to do after the first mock

- Do not buy a new course because the score was lower than expected.
- Do not switch your entire timetable in one day.
- Do not take five more papers before reviewing the first one.
- Do not treat a low score as a prediction of the final result.

The first paper is supposed to expose gaps. That is what makes it useful.

The [mock review guide](/blog/cuet-ug-how-to-review-a-mock-test) walks through the 45-minute review, and the [error log guide](/blog/cuet-ug-error-log-guide) gives the one-page template. When you are ready for a ranked attempt, the [leaderboard](/leaderboard) shows how first attempts are scored.`,
  },
  {
    slug: "cuet-ug-score-plateau-fix",
    title: "Why Your CUET Mock Scores Have Stopped Improving",
    description:
      "A score plateau usually means the practice loop is missing a step. Here are five common causes, how to diagnose yours, and what to change this week.",
    category: "practice",
    publishedAt: "2026-11-07",
    updatedAt: "2026-11-07",
    body: `A plateau is frustrating because it looks like effort has stopped working. Usually the effort is still there; the loop is just repeating the same input and expecting a different output.

If your last three mock scores are within a few marks of each other, diagnose the loop before adding more papers.

## Cause one: you are repeating, not reviewing

Taking a paper, checking the score and taking another paper is repetition. Improvement comes from changing one behaviour between attempts.

**Test:** Can you name the two changes you made after your last paper? If not, the review step is missing.

**Fix:** Use the 45-minute review routine before the next attempt. Write two changes and apply them.

## Cause two: you are practising comfort topics

Everyone has a chapter that feels good to revise. It produces a pleasant session and no score movement, because it is already strong.

**Test:** Compare the unit that gets the most study time with the unit that loses the most marks. If they are different, you are avoiding the weak unit.

**Fix:** Give the highest-loss unit the first hour of your next three study days, before the comfortable work.

## Cause three: you are ignoring the clock

An untimed accuracy of 80% can become 55% under a section clock. If you practise mostly untimed, the score plateau is really a pacing problem.

**Test:** Check the time per section on your last paper. Did you finish, rush, or leave questions unseen?

**Fix:** Add one timed sectional per week. Use the same interface and marking as the full paper.

## Cause four: you are changing too many things

A new timetable, a new book, a new note-taking app and a new sleep schedule in the same week make it impossible to know what worked.

**Test:** List the changes you made since the plateau began. If the list is long, the experiment is uncontrolled.

**Fix:** Change one variable for two weeks. Keep the rest stable. Measure the same four numbers: score, accuracy, attempts and time per section.

## Cause five: you are chasing new material

New material feels productive because it is visible. But a plateau often comes from shallow coverage of the existing syllabus, not from a missing book.

**Test:** Pick a random unit from your syllabus. Can you explain its five main ideas without notes? If not, the problem is depth, not breadth.

**Fix:** Close the new material for two weeks. Re-read the NCERT chapter, make a one-page recall sheet, and solve ten questions from it.

## The one-week reset

If you recognise two or more causes, run this reset:

- **Day 1:** review the last two papers and list the top two loss units.
- **Day 2–3:** drill those units, untimed, with worked examples.
- **Day 4:** one timed sectional in the weakest subject.
- **Day 5:** review the sectional and fix one process habit.
- **Day 6:** one full paper under exam conditions.
- **Day 7:** rest and read the error log.

Then compare the same four numbers. A plateau does not break because you try harder; it breaks because you change the input.

The [error log guide](/blog/cuet-ug-error-log-guide) and the [mock review guide](/blog/cuet-ug-how-to-review-a-mock-test) are the two habits that most often break a plateau. The [paper library](/mock-tests) provides the timed attempts.`,
  },
  {
    slug: "cuet-ug-last-week-revision-plan",
    title: "CUET Last-Week Revision: A 7-Day Plan",
    description:
      "The final week before CUET should shrink, not expand. A day-by-day plan for revision, light practice, sleep and exam logistics without new-material panic.",
    category: "practice",
    publishedAt: "2026-11-08",
    updatedAt: "2026-11-08",
    body: `The last week before CUET is not the time to discover a new chapter. It is the time to make what you already know reliable. The plan below shrinks the workload deliberately: less new input, more retrieval, and a fixed sleep schedule.

If you have followed a longer plan, this week is a taper. If you have not, it is still enough to organise the knowledge you have.

## Day 1–2: audit, do not study

Open your error log and the last three papers. Make two lists:

- The five units that lost the most marks.
- The three process habits that cost marks repeatedly.

Then choose one action per list. For the units, re-read the NCERT summary and solve ten questions each. For the habits, write a one-line rule to apply in the next paper. Do not start a new subject.

## Day 3–4: two light papers

Take one full paper on each day, preferably at the same time of day as your real exam. Use the real interface, the real marking and a hard clock.

After each paper, do only a short review:

- Which section felt slow?
- Which questions were guesses?
- Which habit rule did you forget?

Stop after the review. Two light papers are enough to keep the interface familiar without draining the week.

## Day 5: formula and recall sheets

Spend the day on one-page sheets:

- formulas and units for numerical subjects;
- dates, names and terms for memory-heavy subjects;
- diagrams you must be able to reproduce;
- a list of exceptions and commonly confused pairs.

Rewrite each sheet from memory, then check it against the book. Rewriting is the retrieval practice; copying is not.

## Day 6: logistics and a short review

- Confirm the centre address, reporting time and route.
- Pack the document folder and print the admit card if you have not already.
- Read the [exam day checklist](/blog/cuet-ug-exam-day-checklist).
- Do one short, easy set — twenty questions, untimed — to stay warm.
- Sleep at your normal time.

Do not spend the evening in a group call dissecting every possible question. Uncertainty is contagious and it does not add marks.

## Day 7: rest and routine

No new questions. No full paper. Read your two lists from Day 1, then put them away. Eat at normal times, walk for twenty minutes, and go to bed early enough that the alarm is not a shock.

If you feel unprepared, remember that the final week is for consolidation, not transformation. A calm candidate with a reliable set of known topics outperforms a panicked candidate who tried to add a new one.

## What to avoid

- Starting a new reference book.
- Taking five full papers in seven days.
- Changing your sleep schedule by more than an hour.
- Comparing scores with friends on the morning of the exam.
- Re-reading the entire syllabus "just in case".

The [important dates page](/cuet-ug-important-dates) keeps the official timeline, the [exam pattern guide](/cuet-ug-exam-pattern) refreshes the structure, and the [paper library](/mock-tests) is there for the two light attempts. After the exam, the review habit continues; before it, the goal is a steady hand.`,
  },
];
