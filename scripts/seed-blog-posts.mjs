#!/usr/bin/env node
/**
 * scripts/seed-blog-posts.mjs
 *
 * Seeds the blog with evergreen CUET guides (SEO content). Idempotent:
 * INSERT OR IGNORE by slug, so re-running never overwrites edits made in
 * /admin/blog — delete a row there first if you want the seeded copy back.
 *
 * Usage:
 *   node scripts/seed-blog-posts.mjs            # local D1 (miniflare)
 *   node scripts/seed-blog-posts.mjs --remote   # production D1 (cuet-blueprint-db)
 */

import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const WRANGLER_BIN = resolve(ROOT, "node_modules/wrangler/bin/wrangler.js");
const DB_NAME = "cuet-blueprint-db";
const REMOTE = process.argv.includes("--remote");
const TARGET = REMOTE ? "--remote" : "--local";

function sqlString(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

const POSTS = [
  {
    slug: "how-to-use-cuet-previous-year-papers",
    title: "How to Use CUET Previous Year Papers for Preparation",
    description:
      "A practical routine for solving CUET previous-year papers: timed attempts, an error log, retake loops and how to turn old papers into measurable score gains.",
    body: `Reading a previous-year paper teaches you far less than attempting it under exam rules. Most aspirants skim solved PDFs and walk into the exam hall having never sat a full timed paper — and it shows in their pacing. Here is a routine that treats PYQs as training, not reading material.

## Attempt before you study a paper

Pick one paper and attempt the whole thing in one sitting before looking at a single solution. The point of the first pass is honest data: which questions you skipped, where the clock pressured you, and which topics you guessed on.

- Set a timer for the paper's real duration and do not pause it.
- Mark every question you are unsure about instead of stalling on it.
- Submit even if the paper feels unfinished — an unfinished honest attempt beats a perfectly solved open-book read.

You can attempt any paper in our [previous-year library](/mock-tests) as a ranked mock with the same +5/−1 marking as the exam.

## Build an error log, not a stack of solved PDFs

After the attempt, sort every mistake into one of three buckets:

1. **Concept gap** — you did not know the method. Relearn it from your notes or textbook before retaking.
2. **Process slip** — you knew it but misread, mis-signed or rushed. These are the cheapest marks to recover.
3. **Time pressure** — correct thinking, too slow. These need timed repetition, not more theory.

Keep this log in a notebook or a spreadsheet. Ten lines per paper is enough; the discipline of writing down *why* each mark was lost is what changes the next attempt.

## The retake loop

A paper you scored 60% on is not finished with you. After fixing the error log, retake the same paper after a week. On this platform every attempt is scored against the stored answer key, and the [leaderboard](/leaderboard) shows where your first attempt stands — use later attempts as a private progress check, not the ranked one.

A simple weekly rhythm that works for most students:

- Two full PYQ papers, timed, on fixed days.
- One session reviewing only the error log from those papers.
- One short subject drill on whichever bucket dominated the log.

## Read the paper as an examiner would

After two attempts, read the paper once more purely for pattern-spotting: which topics repeat across shifts, how options are designed to punish partial knowledge, where the long questions sit. That map is what lets you decide, in the exam hall, what to attempt first and what to leave for the final minutes.

Start with a recent shift such as the [English 6 June 2026 paper](/mock-tests/english-2026-06-06-shift-1) or the [Chemistry 6 June 2026 paper](/mock-tests/chemistry-2026-06-06-shift-1), and work backwards through earlier years. The papers are free, the scoring is instant, and every attempt teaches you something the solved PDF never will.`,
  },
  {
    slug: "cuet-marking-scheme-explained",
    title: "CUET Marking Scheme Explained: +5 for Right, −1 for Wrong",
    description:
      "How the +5/−1 CUET marking scheme changes strategy: expected value of guessing, when to skip, and how ranked practice on this site mirrors the same rules.",
    body: `CUET UG scores each question **+5 for a correct answer and −1 for a wrong one**, with unattempted questions scoring zero. That single asymmetry shapes almost every strategic decision in the exam — how aggressive to be, when to skip, and what "attempting everything" actually costs.

## The arithmetic of a blind guess

With four options and no idea which is right, a guess has an expected value of roughly **+0.2 marks**: one chance in four of gaining 5, three chances of losing 1. Over twenty blind guesses that is a coin-flippy +4 — not a disaster, but not the free marks students imagine either.

The picture changes once you can eliminate options:

- Eliminate one option and the expected value of a guess rises to about +1.5.
- Eliminate two and it climbs to roughly +2.8.

The lesson is not "never guess" — it is that guessing pays in proportion to what you can rule out. Partial knowledge is worth money in CUET.

## When skipping is the right call

Skipping is free (zero marks), so the bar for attempting should be: *can I eliminate at least one option, or recall something concrete?* If neither, the question is a candidate for a flagged review rather than an instant guess. The exam interface on this platform — and in the real hall — has a mark-for-review palette for exactly this.

## The cost of streak-guessing

Under time pressure students often guess a run of five questions in a row. Five blind guesses have about a one-in-three chance of coming out net-negative (two or more correct), and a one-in-eight chance of landing at −5. Variance, not the average, is what sinks scores at the margin — which is why the skip rule matters most in the last ten minutes.

## Practising under the same scheme

Every ranked paper on this site uses the published scheme by default: **+5 correct, −1 wrong, 0 unattempted**, with the section-wise timing guidance on the [exam pattern page](/cuet-ug-exam-pattern). The marking details are shown on each question during the attempt, and the [marking scheme guide](/cuet-ug-marking-scheme) walks through the full rules.

Because the scoring is identical, the strategy you rehearse here transfers: the [leaderboard](/leaderboard) ranks first attempts by score, then time, then accuracy — so fast, accurate papers win, exactly like the real thing. For the full subject map before you pick papers, see the [syllabus guide](/cuet-ug-syllabus).`,
  },
  {
    slug: "30-day-cuet-revision-plan",
    title: "A 30-Day CUET Revision Plan That Actually Works",
    description:
      "A week-by-week CUET revision plan built around timed mocks, error logs and subject rotation — with a simple rule for what matters in the final 72 hours.",
    body: `Thirty days is enough to change a CUET score — if the hours go into timed practice and review rather than passive re-reading. This plan assumes you have covered most of the syllabus once and need consolidation. It rotates three activities: full timed papers, error-log review, and targeted subject drills.

## Week 1 — Baseline and triage

- Attempt **three full papers** across different subjects on alternate days, timed, no pausing.
- After each, build the error log: concept gap, process slip, or time pressure.
- Rank your subjects by the log, not by feeling. The weakest subject by *marks lost*, not by difficulty, gets the most drills this week.

Do not buy new material in week one. The baseline data you generate here decides everything else.

## Week 2 — Drill the top two gaps

- One full paper every second day; keep the error log running.
- On the off days, drill only the two highest-cost topics from week 1 — twenty to thirty questions each, untimed, focused on method.
- Re-attempt the worst paper of week 1 and compare against the log.

## Week 3 — Speed and the second tier

- Full papers now on a strict clock, including the questions you would normally skip.
- Add one speed drill per subject: same topic, half the time, accuracy tracked.
- If a subject is still bleeding marks, cut your losses strategically — CUET lets you choose where your attempts go, and a stable strong subject usually outranks a shaky rescue.

## The final week — rehearsal, not learning

- Two papers in the first four days, at exam time of day if possible.
- Nothing new after that. Re-read your error log end to end — it is now a personalised list of your actual failure modes.
- Last 48 hours: one light paper, sleep on schedule, and a read of the [exam pattern](/cuet-ug-exam-pattern) and [important dates](/cuet-ug-important-dates) pages so logistics are not a surprise.

## The rule that makes this work

Every paper must end with **written** reasons for lost marks. Plans fail when the review step is skipped because "the result page already shows the score". The score is not the lesson; the error log is.

All papers in the [library](/mock-tests) autosave and score against the stored key, so a 30-day plan needs nothing more than this site, a notebook, and honest clocks. For subject-level scope before you start, the [syllabus map](/cuet-ug-syllabus) has the section-wise breakdown.`,
  },
  {
    slug: "cuet-english-section-guide",
    title: "CUET English Section: What to Practise and How",
    description:
      "What the CUET English section actually tests, which question types repeat, and a practice routine built around previous-year reading-comprehension sets.",
    body: `The CUET English section rewards two things — reading speed and vocabulary in context — and punishes vague preparation. It is also the section where previous-year papers help the most, because the question types repeat far more predictably than students expect.

## The question types that keep coming back

Across recent shifts the section is built from a small set of recurring forms:

1. **Reading comprehension** — a passage followed by inference, tone and vocabulary-in-context questions.
2. **Verbal ability** — sentence completion, para-jumbles and sentence rearrangement.
3. **Vocabulary** — synonyms, antonyms and one-word substitutions, almost always tested *in a sentence*, never as a bare word pair.
4. **Grammar in use** — error spotting and fill-in-the-blank items tied to tense, prepositions and agreement.

Notice what is missing: there is no essay, no grammar-rule recitation. Everything is applied, which is why flashcards alone stall at a plateau.

## A practice routine that targets the section

- **Daily RC set**: one full passage, timed, from a previous paper. Inference questions first — they carry the marks that vocabulary questions cannot replace.
- **Vocabulary in context**: when you meet an unknown word in a passage, log it with *the sentence it appeared in*, not a bare definition. Context recall beats list recall.
- **Para-jumbles**: practise the link-finding method — pairs first, then order — rather than reading all options linearly.

The [English 6 August 2022 paper](/mock-tests/english-2022-08-06-shift-1) and the [English 6 June 2026 paper](/mock-tests/english-2026-06-06-shift-1) are good anchors: both are timed, both score with the real +5/−1 scheme, and both will show you your true reading speed within one attempt.

## The two mistakes that cost English marks

- **Re-reading the passage linearly** for every question. Read once for structure, then answer from memory of the map, returning only to verify.
- **Vocabulary guessing without elimination.** Even two ruled-out options flip a guess from coin-flip to profitable — the marking arithmetic is covered in the [marking scheme guide](/cuet-ug-marking-scheme).

For the full unit list and section scope, the [syllabus page](/cuet-ug-syllabus) keeps the official structure, and the whole [previous-year library](/mock-tests) filters by subject and year when you want nothing but English sets.`,
  },
  {
    slug: "cuet-percentile-and-rank-explained",
    title: "How the CUET Percentile and Rank on This Site Are Calculated",
    description:
      "Percentile and rank on this site come from first ranked attempts only. Here is the exact formula, the three tie-breakers, and what is not included.",
    body: `After a ranked attempt, the result page shows a score, a rank and a percentile. These numbers are computed on the server from stored attempts — never sent by the browser — and they follow one fixed rule. Knowing the rule makes the leaderboard readable instead of mysterious.

## What counts as a ranked attempt

Three conditions must all hold:

1. The attempt was **submitted** (expired attempts are scored but never ranked).
2. It is the candidate's **first submitted attempt** on that paper — retakes are scored for practice but do not take a new ranked slot.
3. The candidate is a **signed-in user**; guest attempts stay private to the device.

## The ranking rule

Ranked attempts are ordered by three keys, in this exact order:

- **Score, highest first.**
- **Time taken, lowest first** — among equal scores, the faster attempt wins.
- **Accuracy, highest first** — among equal scores and equal times, the attempt with more correct answers and fewer wrong ones wins.

The result page and the [leaderboard](/leaderboard) apply the same rule, so the rank you see on your result matches the position on the public board.

## The percentile formula

Percentile answers a narrower question than rank: *what fraction of ranked attempts did you finish ahead of?* It is computed as:

> percentile = (eligible attempts − your rank + 1) ÷ eligible attempts × 100, rounded to one decimal place.

So being 1st of 200 is the 100th percentile; being 50th of 200 is the 75.3rd percentile. Both rank and percentile are computed only when at least one other eligible attempt exists.

## What these numbers are not

- They are **not official NTA results** and not a national percentile — they describe your standing among ranked attempts on this platform only.
- They are **not permanent**: as more students attempt the paper, the same score can sit at a different rank. That movement is information — it tells you how competitive the paper's field is.

Use the per-paper [leaderboards](/leaderboard) to pick papers where the field is strong, and the [previous-year library](/mock-tests) to find the next paper to attempt. The scoring rules themselves are documented on the [marking scheme page](/cuet-ug-marking-scheme).`,
  },
  {
    slug: "exam-day-mistakes-to-avoid-cuet",
    title: "Seven Mistakes to Avoid in the CUET Exam Hall",
    description:
      "Seven exam-hall mistakes that cost real marks in CUET — from palette neglect to guessing streaks — and the habits that prevent each one.",
    body: `Most CUET marks are not lost on hard questions; they are lost on process. These seven mistakes show up in almost every post-mortem of a disappointing score, and each has a habit that prevents it.

## 1. Ignoring the mark-for-review palette

The palette is not decoration. Questions you flag get a second pass while unflagged gaps stay invisible until the clock punishes them. **Habit:** flag anything you skip within three seconds of skipping it.

## 2. Re-reading passages question by question

Linear re-reading per question quietly eats minutes. **Habit:** read the passage once for structure, then answer from the map and verify only on doubt.

## 3. Guessing streaks in the last ten minutes

Five blind guesses under panic have roughly a one-in-eight chance of landing at −5, and the average is barely positive. **Habit:** in the final stretch, attempt only questions where you can eliminate at least one option. The arithmetic is in the [marking scheme guide](/cuet-ug-marking-scheme).

## 4. Spending equal time on unequal questions

Every question pays the same +5. A hard item worth five marks that eats four minutes is worse than two easy items worth ten. **Habit:** one pass for easy marks, one pass for medium, and hard items only if time remains.

## 5. Not checking the section clock

CUET sections have separate time budgets. A strong first section can quietly starve the last one. **Habit:** check the section timer at every palette visit and set a mental deadline per section.

## 6. Leaving questions unattempted by accident

An unanswered question you actually knew is the purest loss in the exam. **Habit:** in the final minutes, sweep the palette for grey (not-answered) buttons and make a deliberate decision on each — attempt or skip, never "didn't see it".

## 7. Treating the first attempt as a rehearsal

Students who plan to "get a feel" in the first minutes lose them. **Habit:** the first three minutes are for the instruction screen and the easiest marks, exactly like the timed papers in the [practice library](/mock-tests) — where every attempt runs the full NTA-style palette, timer and autosave so the real interface feels like a rerun.

Prepare the habits in practice, and the exam hall becomes the easiest paper of the month. The [previous-year papers hub](/cuet-ug-previous-year-papers) is the place to start, and the [important dates page](/cuet-ug-important-dates) keeps the logistics honest.`,
  },
  {
    slug: "cuet-vs-board-exams-balance",
    title: "CUET vs Board Exams: A Balanced Preparation Plan",
    description:
      "Boards and CUET test overlapping syllabi with different skills. Here is a single weekly plan that serves both — and the point where their demands split.",
    body: `The good news first: CUET domain subjects draw from the same NCERT ground your boards cover. The bad news: the two exams reward different skills. Boards reward structured long answers; CUET rewards fast, precise multiple-choice decisions under a clock. A plan that serves one and ignores the other wastes your strongest overlap.

## What actually overlaps

- **Content**: the NCERT units for your domain subjects appear in both exams. One revision pass can serve two masters.
- **Nothing else**. Answer presentation, time per question and question format diverge completely.

So the overlap is in *what you know*, not in *how you are tested*. Plan accordingly: study the content once, then practise both exam formats separately.

## A weekly split that works

- **Board-heavy weeks** (pre-boards, practicals): keep one CUET paper each weekend plus fifteen minutes of error-log review. This is maintenance, not growth — and it is enough to hold the format.
- **Normal weeks**: alternate days. Four days board answer-writing and subject depth; two days timed CUET practice; one day off.
- **Final six weeks before CUET**: the ratio flips. CUET practice takes the weekdays, boards keep the weekends, because by then board writing is muscle memory and CUET pacing is not.

## The one habit that serves both

An error log. A board answer returned with "incomplete" and a CUET question you skipped both go into the same log, tagged by cause. Reading it weekly tells you whether your problem is knowledge (fix content), method (fix technique) or timing (fix clocks) — which is the same diagnosis both exams need.

## Where to spend CUET practice hours

Pick papers from the [previous-year library](/mock-tests) rather than random question banks: every attempt is timed, scored +5/−1, and ends with a review screen, so one hour of practice produces the same data as an hour of boards practice plus a self-check.

Subject scope is identical to the boards — the [syllabus map](/cuet-ug-syllabus) shows the section-wise breakdown per subject, and the [exam pattern page](/cuet-ug-exam-pattern) summarises how CUET structures the same content into sections and time budgets.`,
  },
  {
    slug: "cuet-general-test-strategy",
    title: "CUET General Test: Strategy for Quant, Reasoning and GK",
    description:
      "The CUET General Test mixes quantitative reasoning, logical reasoning and general knowledge. Section-wise strategy, pacing rules and what to practise daily.",
    body: `The General Test is the most uneven section in CUET — the syllabus is wide, the questions are short, and the clock is the real opponent. Students lose marks here not to difficulty but to decision speed: knowing *instantly* whether a question is worth attempting.

## The three content families

1. **Quantitative reasoning** — arithmetic, percentages, ratios, basic number work and interpretation of simple data. Class-8-to-10 level maths applied under time pressure.
2. **Logical and analytical reasoning** — series, coding-decoding, syllogisms, direction sense, puzzles and odd-one-out items.
3. **General knowledge and current affairs** — static GK (books, awards, geography, polity basics) plus recent events.

Each family needs a different kind of practice, which is why "solving GT papers" alone plateaus fast.

## Section-wise strategy

- **Quant**: the marks are in calculation hygiene. Practise fractions, percentage-change and ratio shortcuts daily — ten minutes, every day, beats a three-hour weekend session. If a question needs algebra beyond two steps at reading speed, skip it on the first pass.
- **Reasoning**: this is the most learnable family. Series and coding-decoding follow a small set of patterns; drilling twenty items per pattern makes recognition instant. Syllogisms need diagram habits, not intuition.
- **GK and current affairs**: the only family where reading helps. A daily fifteen-minute habit of one current-affairs digest plus a static-GK topic beats last-minute cramming, because recall — not understanding — is tested.

## Pacing rule for the paper

The General Test rewards the same pass system as every other section: first pass for instant-recall items, second pass for the thinkable ones, and hard quant left for the end. Because the section clock is shared, a single stubborn puzzle can starve ten easy GK questions — the palette exists so you never have to let that happen.

## Practising with real papers

The [General Test 30 May 2026 paper](/mock-tests/general-test-2026-05-30-shift-1) runs with the full timed interface and +5/−1 scoring, and the [paper library](/mock-tests) filters by year and shift when you want more sets. Track which family bleeds marks in your error log — most students find quant timing and GK recall are separate problems needing separate fixes. The [exam pattern page](/cuet-ug-exam-pattern) summarises the section structure, and the [syllabus map](/cuet-ug-syllabus) lists the unit scope.`,
  },
  {
    slug: "cuet-physics-preparation-guide",
    title: "CUET Physics Preparation: From Formulas to Timed Papers",
    description:
      "A CUET Physics routine that works: unit-wise formula discipline, numerical speed drills, the common trap in each broad topic, and how to use previous-year papers.",
    body: `CUET Physics is a speed exam wearing a theory exam's clothes. The syllabus matches what you already study for boards, but the questions demand a formula recalled *and applied* in under a minute. Preparation that reads concepts without solving timed numericals will feel prepared and score poorly.

## Unit-wise priority

Weight follows the NCERT units, and your effort should follow the weight:

1. **Electrodynamics** — current electricity, magnetism, EMI and AC. Formula-dense and heavily tested; these questions are the fastest marks once the standard setups are automatic.
2. **Mechanics** — kinematics, laws of motion, work-energy, rotation. The trap is sign and frame errors, not difficulty.
3. **Optics and waves** — ray diagrams, interference and doppler basics. Short formulas, direct questions.
4. **Thermodynamics and modern physics** — photoelectric effect, atoms, nuclei, semiconductors. Mostly one-formula items; the highest marks-per-minute in the paper.

## The practice loop

- **Formula sheet in your own handwriting**, one page per unit, rewritten from memory — not copied — every weekend. Rewriting is the test.
- **Daily numerical drill**: ten problems from your weakest unit, timed at ninety seconds each.
- **Weekly timed paper**: a full previous-year Physics shift on this platform, where every numerical is scored and the review screen shows exactly which units bled marks. Start with the [Physics 19 July 2024 paper](/mock-tests/physics-2024-07-19-shift-1).

## The three traps that cost marks

- **Sign and unit slips** — the answer you compute is right except for a sign carried from the formula. Write the formula with units before substituting.
- **Diagram-dependent questions** attempted without drawing. Draw the ray diagram or the circuit; memory sketches fail.
- **Modern physics skipped as "easy marks"** and then misread — the questions are short precisely because the wording is tight.

For the official unit list, the [syllabus page](/cuet-ug-syllabus) maps every unit, and the [exam pattern guide](/cuet-ug-exam-pattern) explains the section timing. The full [paper library](/mock-tests) filters Physics papers by year and shift for your weekly timed attempt.`,
  },
  {
    slug: "cuet-chemistry-preparation-guide",
    title: "CUET Chemistry Preparation: Physical, Organic, Inorganic",
    description:
      "How to split CUET Chemistry preparation across physical, organic and inorganic chemistry — different skills, different drills, one weekly timed-paper loop.",
    body: `Chemistry is the one CUET subject where studying the *right way per branch* matters more than total hours. Physical, organic and inorganic chemistry fail students for three different reasons, and a single study method cannot fix all three.

## Physical chemistry — speed through formula fluency

Mole concept, thermodynamics, equilibrium, electrochemistry and kinetics are numerical marks. The failure mode is slow arithmetic, not weak theory.

- Maintain a one-page formula sheet per chapter, rewritten from memory weekly.
- Drill ten numericals a day at ninety seconds each — the clock is part of the learning.
- Redo every question you got wrong three days later; physical-chemistry errors repeat until the method is automatic.

## Organic chemistry — reactions as a map, not a list

Students fail organic by memorising hundreds of isolated reactions. The syllabus is a small set of mechanisms — addition, substitution, elimination, nucleophilic attack on carbonyls — applied across families.

- Learn reagents by what they *do*, then place them on a single reaction map covering alcohols, aldehydes, ketones, acids and amines.
- Practise **why**: for every conversion, one line on the mechanism. CUET options are built to punish pattern-matching without understanding.
- Name reactions get a dedicated revision card each — the exam asks them directly.

## Inorganic chemistry — pure recall, so treat it like GK

Periodic trends, coordination compounds, metallurgy and p-block are memory marks. No derivation saves you; only repetition does.

- Fifteen minutes daily beats two hours weekly — recall decays fast.
- Use the exceptions list (anomalous behaviour, colour, oxidation states) as its own sheet; examiners love exceptions.

## The weekly loop that binds them

One full timed paper each week — the [Chemistry 6 June 2026 paper](/mock-tests/chemistry-2026-06-06-shift-1) is a recent shift with the real +5/−1 scoring — then sort the error log by branch. Whichever branch lost the most marks owns the next week's drills. The [paper library](/mock-tests) filters Chemistry sets by year and shift, the [syllabus page](/cuet-ug-syllabus) lists the unit scope, and the [exam pattern guide](/cuet-ug-exam-pattern) covers the section structure.`,
  },
  {
    slug: "how-many-cuet-mock-tests-to-attempt",
    title: "How Many CUET Mock Tests Should You Attempt?",
    description:
      "There is a ceiling where more mock tests stop helping. Here is how to count attempts, space them, and tell the difference between practice and grinding.",
    body: `"How many mocks?" is the wrong first question. The right one is: *how many reviewed mocks?* An unreviewed mock is a score with no lesson attached, and twenty of them teach less than six properly reviewed ones.

## The honest numbers

For most aspirants over a two-to-three-month window:

- **8 to 12 full timed papers** is the productive ceiling.
- **One full paper every two to three days** — daily full papers buy familiarity at the price of review time and sleep.
- Below six, the interface and pacing never become automatic. Above fifteen, scores plateau and anxiety rises.

These are full papers. Subject drills and section practice sit outside this count and happen daily.

## The review half of every attempt

Budget review time equal to half the paper's duration, immediately after submitting:

1. Sort every lost mark: concept gap, process slip, or time pressure.
2. Note which *units* bled marks, not just which questions.
3. Write the two changes you will make in the next paper. Two, not ten.

The result screen on this platform shows section-wise accuracy, time spent and the ranked position, and every attempt is autosaved — so the review data is there the moment you submit.

## Spacing beats stacking

Two papers with an error-log review between them beat three back-to-back papers. The review changes what you practise next; stacking mocks just repeats the same mistakes at the same speed. If you cannot say what the last paper changed, you are grinding, not practising.

## A simple schedule

- **Weeks 1–4**: two full papers per week across different subjects, plus daily short drills.
- **Weeks 5–8**: three papers per week in exam-time slots, error log between each.
- **Final two weeks**: two papers, then stop adding. Re-read the log instead.

Start from the [paper library](/mock-tests) — filter by subject and year, attempt any [previous-year shift](/mock-tests/english-2026-06-06-shift-1) under real rules, and let the [leaderboards](/leaderboard) show where each first attempt stands. The scoring and timing rules are the ones explained on the [exam pattern page](/cuet-ug-exam-pattern).`,
  },
  {
    slug: "how-to-choose-cuet-domain-subjects",
    title: "How to Choose Your CUET Domain Subjects",
    description:
      "A decision framework for CUET domain subject selection: programme requirements first, then overlap with your board stream, then scoring potential.",
    body: `Domain subject selection is the highest-leverage decision in CUET — it decides which programmes you are even eligible for, long before scores enter the picture. Yet most students choose by copying friends. Use this order instead.

## Step 1 — Work backwards from programmes

Every university programme lists required or preferred domain subjects. The decision is not "what am I good at" but "what does my target programme demand". A B.Com (Hons) seat that requires Business Studies cannot be reached with a Physics paper, however strong.

- List two or three programmes and universities you actually want.
- Write down their domain subject requirements.
- That list is your constraint — everything else optimises within it.

Requirements differ across universities, so read the admission pages of each rather than relying on a friend's summary. The [syllabus map](/cuet-ug-syllabus) then shows what each subject's paper covers unit by unit.

## Step 2 — Prefer your board subjects

Where the programme allows a choice, your board subjects have a built-in advantage: one revision pass serves two exams, and a year of class work is a year of preparation. A PCM student picking Mathematics beats a PCM student picking a subject they have never studied, at equal effort.

## Step 3 — Check scoring potential honestly

Some subjects suit MCQ testing better than others. Ask of each candidate subject:

1. Is the syllabus finishable in your remaining time?
2. Are past papers available to practise from? (The [paper library](/mock-tests) shows which subjects have real previous-year shifts.)
3. Does your error-log data — not your comfort — say the marks are reachable?

Attempt one previous-year paper in each candidate subject before finalising. A single timed attempt, scored with the real +5/−1 scheme, tells you more than a week of opinions — including from this article.

## The arithmetic reminder

Every domain subject is a separate section with its own clock and the same +5/−1 scheme described in the [marking guide](/cuet-ug-marking-scheme). Choosing five subjects means five preparation tracks; choosing well means fewer, stronger tracks. The [exam pattern page](/cuet-ug-exam-pattern) shows how sections and timings fit together, and the [previous-year papers hub](/cuet-ug-previous-year-papers) lists what is available per subject and year.`,
  },
];

function runWrangler(args, stdio) {
  return execFileSync(process.execPath, [WRANGLER_BIN, "d1", "execute", DB_NAME, TARGET, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio,
    timeout: 180_000,
  });
}

// wrangler expects the SQL in a file for multi-statement seeds.
const statements = POSTS.map((post) => `INSERT OR IGNORE INTO blog_posts
  (slug, title, description, body, status, published_at, created_at)
VALUES
  (${sqlString(post.slug)}, ${sqlString(post.title)}, ${sqlString(post.description)},
   ${sqlString(post.body)}, 'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));`);
const sqlFile = resolve(ROOT, ".wrangler/seed-blog-posts.sql");
writeFileSync(sqlFile, `${statements.join("\n")}\n`, "utf8");

try {
  runWrangler(["--file", sqlFile], "ignore");
  console.log(
    `Seeded ${POSTS.length} blog posts into ${DB_NAME} (${TARGET}): ${POSTS.map((p) => p.slug).join(", ")}`,
  );
} finally {
  try {
    unlinkSync(sqlFile);
  } catch {
    // best-effort cleanup
  }
}
