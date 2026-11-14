import type { StaticGuide } from "./types";

/**
 * Subject guides, part one. Each guide follows the same shape: what the paper
 * rewards, a unit-level priority list, a weekly loop, and the traps that cost
 * marks in that subject.
 */
export const SUBJECT_GUIDES_A: StaticGuide[] = [
  {
    slug: "cuet-ug-accountancy-preparation-guide",
    title: "CUET Accountancy Preparation: A Unit-by-Unit Plan",
    description:
      "A CUET Accountancy plan built around journal entries, partnership accounts, company accounts and financial statement analysis, with a weekly timed-paper loop.",
    category: "subject-strategy",
    publishedAt: "2026-09-20",
    updatedAt: "2026-11-02",
    body: `Accountancy rewards a specific kind of fluency: you should be able to look at a transaction and see the debit and credit before you see the wording of the options. That fluency is built with repetition, not with long reading sessions.

The CUET paper tests both preparation and interpretation. You need to know how a statement is built, and you need to read a set of ratios or a cash-flow extract without losing the thread.

## What the paper rewards

Most questions come from four families:

- **Journal, ledger and trial balance** — recording a transaction correctly and carrying it through.
- **Financial statements** — preparing and reading the statement of profit and loss and the balance sheet.
- **Partnership accounts** — admission, retirement, admission of a partner, profit-sharing changes and adjustments.
- **Company accounts and analysis** — share capital, debentures, and ratio or cash-flow interpretation.

The exact unit list is in the [syllabus](/cuet-ug-syllabus). Treat it as the boundary; do not spend weeks on a topic that the paper does not list.

## Build the journal habit first

Every accounting question starts with the same micro-skill: identify the accounts, decide the debit and credit, and write the narration. If this is slow, the rest of the paper is slow.

A daily drill that works:

1. Take ten transactions from the NCERT exercises.
2. Write the journal entry with narration, without looking at the solution.
3. Check the entry immediately.
4. For every wrong entry, write the reason in one line.

Fifteen minutes a day for two weeks will do more for accuracy than a weekend of reading the chapter.

## Partnership and company accounts

These units look large because they have many formats. The marks are usually in the adjustments, not in the story.

- For admission and retirement, write the adjustment table before touching the capital accounts.
- For share capital, separate the application, allotment and calls stages.
- For debentures, check whether the question says issued at par, premium or discount.
- For every format, practise one full question end to end. Half a format is not knowledge.

Use the [accountancy subject hub](/cuet-mock-test/accountancy) to find the available previous-year sets. The [2023 shift 1 paper](/cuet-ug-previous-year-question-papers/domain-subject-pyqs/accountancy/accountancy-2023-06-01-shift-1) is a useful timed attempt once the basics are in place.

## Interpretation questions

Ratio analysis and cash-flow questions are reading questions disguised as calculation questions. Before calculating, ask:

- What is the question actually comparing?
- Which year is the base?
- Is the answer a ratio, a percentage or an amount?
- Are the units consistent?

A common error is computing the right number and then choosing an option with the wrong unit. Slow down for the final line.

## Weekly loop

- **Three days** — one unit drill: ten journal entries or one full format question.
- **Two days** — ten MCQs from a previous-year paper, timed.
- **One day** — a full timed paper or a sectional.
- **One day** — review: re-solve wrong questions and update the error log.

The [error log guide](/blog/cuet-ug-error-log-guide) explains how to tag accounting errors: concept, process or time pressure.

## Traps that cost marks

- Forgetting adjustments such as closing stock, outstanding expenses or depreciation.
- Mixing capital and revenue items.
- Treating a provision as an expense without checking the wording.
- Rushing the narration and then choosing an option based on the narration.

Accountancy is one of the most trainable CUET subjects. The paper rewards clean, repeated method. Build the method, then let the clock test it.`,
  },
  {
    slug: "cuet-ug-business-studies-preparation-guide",
    title: "CUET Business Studies: Preparation and Answer Strategy",
    description:
      "CUET Business Studies: concept maps for management and marketing, recall drills for forms of business, and timed practice on case-style questions.",
    category: "subject-strategy",
    publishedAt: "2026-09-24",
    updatedAt: "2026-11-02",
    body: `Business Studies looks like a reading subject until the options arrive. Then you discover that "recruitment" and "selection" are different, that "advertising" and "publicity" are not interchangeable, and that a case question can hide the concept behind a familiar example.

The paper rewards precise definitions and the ability to apply them to a short situation.

## The shape of the paper

Most questions come from the management side of the syllabus:

- nature and purpose of business, and forms of business organisation;
- private, public and global enterprises;
- planning, organising, staffing, directing and controlling;
- financial management and the capital structure decision;
- marketing management and consumer protection.

The current unit list is on the [syllabus page](/cuet-ug-syllabus). Start there, then build one concept map per chapter.

## Concept maps beat long notes

For each chapter, make a one-page map with four layers:

1. **Definition** in one sentence.
2. **Features** as a short list.
3. **Merits and demerits** in two columns.
4. **One example** from an Indian business context.

This format matches the way CUET asks: identify the concept, recall its features, or choose the correct merit from a list.

For example, a map on "delegation" should separate authority, responsibility and accountability. If you can explain why responsibility cannot be delegated, most questions on the topic become easy.

## Case-style questions

A case question gives a short situation and asks which concept it illustrates. The mistake is to answer from the story instead of from the chapter.

Use this order:

1. Read the question stem first — what is being asked?
2. Read the case and underline the action or decision.
3. Name the concept in your own words.
4. Match it to the closest option, not the most impressive one.

If two options are both plausible, the correct one usually uses the exact terminology from the chapter. The distractor is often a related concept with one wrong feature.

## Recall drills

Business Studies has a lot of paired terms. Make a list of the pairs that are easy to confuse:

- recruitment and selection;
- advertising and publicity;
- training and development;
- centralisation and decentralisation;
- functional and divisional structure.

Write the difference in one line each. Review the list twice a week. This is a ten-minute habit with a high return.

## Weekly loop

- **Four days** — one chapter map plus ten MCQs.
- **One day** — a timed sectional from a previous-year paper.
- **One day** — full paper or a mixed set.
- **One day** — review and update the error log.

The [business studies subject hub](/cuet-mock-test/business-studies) collects the available papers. The [2023 shift 3 paper](/cuet-ug-previous-year-question-papers/domain-subject-pyqs/business-studies/business-studies-2023-06-10-shift-3) is a good timed attempt after the first two chapters are mapped.

## Traps that cost marks

- Choosing a feature that belongs to a neighbouring concept.
- Ignoring the words "not" and "except" in the question.
- Over-reading a case and inventing facts that are not there.
- Memorising examples without the definition they illustrate.

The [error log guide](/blog/cuet-ug-error-log-guide) helps separate a definition gap from a case-reading error. Business Studies improves quickly once the vocabulary is precise.`,
  },
  {
    slug: "cuet-ug-economics-preparation-guide",
    title: "CUET Economics: Micro, Macro and Indian Economy",
    description:
      "A CUET Economics routine that separates micro concepts, macro diagrams and Indian economy facts, with graph practice and a weekly previous-year paper.",
    category: "subject-strategy",
    publishedAt: "2026-09-28",
    updatedAt: "2026-11-02",
    body: `Economics is three subjects wearing one name. Microeconomics is about choices and markets, macroeconomics is about the economy as a whole, and Indian economic development is about facts, policies and arguments. Each needs a different study method.

The students who struggle usually apply one method to all three: reading. Reading helps the Indian economy section; it does far less for a graph or a numerical.

## Microeconomics: diagrams and direction

Micro questions often ask what happens to price, quantity or equilibrium when something changes. The answer depends on direction, not on a memorised sentence.

- Practise drawing demand and supply diagrams with labelled axes.
- For every shift, say which curve moves and why.
- Distinguish a movement along a curve from a shift of the curve.
- Drill elasticity and consumer equilibrium numericals separately.

A useful habit: before choosing an option, sketch the diagram on rough paper. The sketch takes ten seconds and prevents most direction errors.

## Macroeconomics: definitions and identities

Macro rewards precise definitions and the ability to read an identity.

- National income: understand the circular flow and the difference between GDP, GNP and national income.
- Money and banking: know the functions of money, credit creation and the role of the central bank.
- Government budget: separate revenue and capital receipts, and revenue and fiscal deficits.
- Balance of payments: distinguish the current account from the capital account.

Write each identity once from memory, then use it in a numerical. If you cannot explain why the identity holds, the formula will not survive a twisted question.

## Indian economy: a fact sheet per theme

This section is memory-heavy. Build one page per theme:

- planning and its objectives;
- liberalisation, privatisation and globalisation;
- poverty and human capital;
- rural development and infrastructure;
- sustainable development.

For each theme, keep three things: a definition, two data points or examples from the NCERT text, and one argument for and against. Do not collect numbers from random sources; use the textbook's framing.

## Weekly loop

- **Three days** — one micro or macro topic, with five numericals or two diagrams.
- **Two days** — Indian economy theme revision and ten MCQs.
- **One day** — timed sectional.
- **One day** — full paper or review.

The [economics subject hub](/cuet-mock-test/economics) lists the available sets. The [2024 shift 1 paper](/cuet-ug-previous-year-question-papers/domain-subject-pyqs/economics/economics-2024-05-16-shift-1) is a good first timed attempt.

## Traps that cost marks

- Confusing a shift with a movement along a curve.
- Mixing GDP and GNP.
- Treating fiscal deficit and revenue deficit as the same thing.
- Answering an Indian economy question from general knowledge instead of the textbook frame.

The [syllabus page](/cuet-ug-syllabus) lists the unit boundaries, and the [error log guide](/blog/cuet-ug-error-log-guide) helps you separate a definition gap from a graph-reading slip.`,
  },
  {
    slug: "cuet-ug-biology-preparation-guide",
    title: "CUET Biology Preparation: Units, Diagrams and Recall",
    description:
      "A CUET Biology plan covering genetics, reproduction, ecology and biotechnology, with diagram-first revision, NCERT line focus and weekly timed practice.",
    category: "subject-strategy",
    publishedAt: "2026-10-02",
    updatedAt: "2026-11-02",
    body: `Biology is the CUET subject where the textbook line matters most. The paper is built from NCERT content, and many distractors are created by changing one word in a line — "always" becomes "sometimes", "dominant" becomes "recessive", or an enzyme is swapped for its product.

The fix is not to read more outside material. It is to read NCERT actively and test the exact wording.

## What the paper rewards

The high-yield areas tend to be:

- reproduction in organisms, humans and flowering plants;
- genetics, inheritance and molecular biology;
- evolution and human welfare;
- biotechnology and its applications;
- ecology, ecosystems and biodiversity.

The current unit list is on the [syllabus page](/cuet-ug-syllabus). Use it to mark which chapters you have actually practised.

## Diagram-first revision

Biology diagrams are not decoration. They are compressed explanations.

For each diagram:

1. Draw it from memory with labels.
2. Check the labels against the book.
3. Explain the process in three sentences without looking.
4. Answer two questions that use the diagram.

This is slower than highlighting, and it is the reason students who draw retain the pathway while students who only read forget it.

## The one-word trap

CUET options often differ by a single qualifier. When you review a wrong answer, ask:

- Did I miss a word such as "not", "only" or "mainly"?
- Did I confuse a structure with its function?
- Did I remember the exception but not the rule?

Keep a "confusions" page with pairs such as:

- mitosis and meiosis;
- genotype and phenotype;
- primary and secondary succession;
- restriction enzyme and ligase.

Write the difference in one line. Review the page twice a week.

## A weekly loop

- **Three days** — one chapter: draw the key diagram, write a ten-line summary, solve ten MCQs.
- **Two days** — genetics or molecular biology numericals and terminology.
- **One day** — timed sectional.
- **One day** — full paper or review.

The [biology subject hub](/cuet-mock-test/biology) lists the available papers. The [2025 shift 1 paper](/cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/biology-2025-05-20-shift-1) is a recent timed attempt.

## Traps that cost marks

- Reading the summary instead of the chapter.
- Memorising a diagram's labels without the process.
- Ignoring exceptions because they feel minor.
- Guessing between two options that differ by one word.

The [error log guide](/blog/cuet-ug-error-log-guide) helps tag whether an error was a recall gap or a wording slip. In Biology, those two causes need different fixes.`,
  },
  {
    slug: "cuet-ug-mathematics-preparation-guide",
    title: "CUET Mathematics Preparation: Speed With Accuracy",
    description:
      "A CUET Mathematics preparation plan: formula fluency, chapter-wise problem sets, timed sectionals and a review method for calculation errors.",
    category: "subject-strategy",
    publishedAt: "2026-10-06",
    updatedAt: "2026-11-02",
    body: `Mathematics in CUET is a selection exam inside a subject paper. The paper contains more questions than most candidates can solve comfortably, and the marking rule punishes a rushed wrong answer. Speed matters, but only after the method is reliable.

The goal is not to solve every question. It is to recognise quickly which questions you can solve cleanly and which ones should be left for the second pass.

## What the paper rewards

The high-yield areas usually include:

- relations and functions;
- algebra, matrices and determinants;
- calculus: continuity, differentiation, integration and applications;
- vectors and three-dimensional geometry;
- probability;
- linear programming.

The current unit list is on the [syllabus](/cuet-ug-syllabus). Build a formula sheet per unit, but write it from memory rather than copying it.

## Formula fluency

A formula you have to reconstruct during the exam is a time tax. A formula you can write in five seconds is a tool.

- Once a week, take a blank page and write every formula from one unit.
- Check against your sheet and mark the ones you missed.
- Re-write only the missed formulas the next day.
- Use each formula in at least one problem in the same session.

This is more effective than reading a formula list, because the exam asks you to produce the formula under pressure.

## Problem selection

Do not solve in order. In a timed section:

1. Scan the first ten questions and mark the ones you recognise immediately.
2. Solve those first, writing the first step only.
3. Return to the ones that need a setup.
4. Leave the long multi-step questions for the final pass.

The first step is often enough to decide whether a question is worth continuing. If the setup is not clear after thirty seconds, flag it.

## Review calculation errors

Mathematics errors are not all "silly mistakes". Sort them:

- **Concept error** — wrong method or formula.
- **Setup error** — right method, wrong equation or diagram.
- **Calculation error** — sign, arithmetic, unit or transcription.
- **Reading error** — answered a different question than the one asked.

Each has a different fix. Calculation errors need slower written steps; reading errors need the last line read first; concept errors need a re-read and ten fresh problems.

## Weekly loop

- **Four days** — one unit: ten problems, untimed, with full working.
- **One day** — timed sectional of twenty questions.
- **One day** — full paper or mixed set.
- **One day** — review and formula recall.

The [mathematics subject hub](/cuet-mock-test/mathematics) lists the available papers. The [2025 shift 1 paper](/cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/mathematics-2025-06-02-shift-1) is a good timed attempt once the first three units are solid.

## Traps that cost marks

- Rushing a calculation because the method is familiar.
- Forgetting domain restrictions in functions.
- Losing a sign when moving terms.
- Choosing an answer without checking whether the question asks for a value, a range or a number of solutions.

The [error log guide](/blog/cuet-ug-error-log-guide) has the four-cause template. In Mathematics, the log is often more valuable than another problem set.`,
  },
  {
    slug: "cuet-ug-applied-mathematics-guide",
    title: "CUET Applied Mathematics: A Practical Study Plan",
    description:
      "How to prepare CUET Applied Mathematics: financial maths, statistics, probability and linear programming, with calculator-free speed drills and timed papers.",
    category: "subject-strategy",
    publishedAt: "2026-10-10",
    updatedAt: "2026-11-02",
    body: `Applied Mathematics is not a lighter version of core Mathematics. It is a different paper: more arithmetic, more interpretation, and more questions wrapped in a real-world sentence. Students who prepare it like core Maths often lose marks on units, rounding and table reading.

The syllabus is practical, and so should be the practice.

## What the paper rewards

The main families are:

- numbers, quantification and numerical applications;
- algebra and calculus basics;
- probability;
- descriptive statistics;
- financial mathematics;
- linear programming.

The exact unit list is on the [syllabus page](/cuet-ug-syllabus). Check it before you assume a topic is included.

## Arithmetic without a calculator

Applied Mathematics is full of percentages, ratios, averages and interest. The calculator is not part of the exam, so mental arithmetic is a scoring skill.

A daily ten-minute drill:

- convert five fractions to percentages and back;
- compute simple and compound interest for two periods;
- calculate a weighted average;
- estimate an answer before calculating it exactly.

Estimation is useful because it eliminates options quickly. If the exact answer should be near 40 and an option says 400, you can move on without finishing the calculation.

## Financial mathematics

Treat every financial question as three separate decisions:

1. What is the principal, rate and time?
2. Is the interest simple or compound?
3. Is the period in years, months or days?

Write the formula with units before substituting. Most errors in this unit are unit errors, not formula errors.

## Statistics and probability

- For statistics, practise reading a frequency table and computing mean, median and mode from it.
- For dispersion, know what each measure actually describes.
- For probability, write the sample space before applying a formula.
- For interpretation questions, check whether the question asks for a value or a comparison.

A table question is a reading test first. Underline the row and column headings before calculating.

## Linear programming

LPP questions reward a clean setup:

- define the variables in words;
- write the objective function;
- list the constraints with the correct inequality;
- identify the feasible region;
- test the corner points.

If the setup is wrong, every later step is wasted. Spend the extra thirty seconds on the definitions.

## Weekly loop

- **Three days** — one unit drill, ten questions, calculator-free.
- **Two days** — previous-year MCQs, timed.
- **One day** — full paper.
- **One day** — review: units, rounding and table errors.

The [applied mathematics subject hub](/cuet-mock-test/applied-mathematics) lists the available sets. The [2025 shift 1 paper](/cuet-ug-previous-year-question-papers/domain-subject-pyqs/applied-mathematics/applied-mathematics-2025-06-02-shift-1) is a good timed attempt.

## Traps that cost marks

- Using the wrong compounding period.
- Rounding too early in a multi-step calculation.
- Mixing mean, median and mode in a comparison question.
- Writing an LPP constraint with the wrong inequality.

The [error log guide](/blog/cuet-ug-error-log-guide) helps separate arithmetic slips from setup errors. Applied Mathematics improves fast when the arithmetic is automatic.`,
  },
  {
    slug: "cuet-ug-computer-science-guide",
    title: "CUET Computer Science: Python, SQL and Networks",
    description:
      "A CUET Computer Science preparation plan covering Python fundamentals, SQL queries, data structures and networking, with code-tracing drills and timed papers.",
    category: "subject-strategy",
    publishedAt: "2026-10-14",
    updatedAt: "2026-11-02",
    body: `Computer Science is one of the most predictable CUET domain papers. The concepts are finite, the code is short, and the questions often ask you to trace an output rather than write a program from scratch. That makes it a strong scoring subject for students who practise the right way.

The wrong way is to read code. The right way is to trace it on paper.

## What the paper rewards

The core areas are:

- Python fundamentals: data types, operators, control flow, functions, strings and lists;
- data structures: stacks, queues and basic operations;
- database concepts and SQL queries;
- computer networks: topologies, protocols and basic security concepts;
- Boolean logic and number systems where the syllabus includes them.

The current unit list is on the [syllabus page](/cuet-ug-syllabus). Use it as the boundary.

## Trace code on paper

For every code snippet:

1. Write the initial values of the variables.
2. Execute one line at a time, updating the values in a table.
3. Write the output before checking the answer.
4. If the output is wrong, mark the exact line where your trace diverged.

This is slower than reading, and it builds the exact skill the paper tests. Ten traced snippets a day beat a hundred read ones.

Pay special attention to:

- indentation and block scope;
- mutable versus immutable objects;
- list indexing and slicing;
- loop boundaries;
- integer division and string concatenation.

## SQL: write the query, then check the clause order

SQL questions usually ask for a result, not a full application. Practise the clause order:

- SELECT what?
- FROM which table?
- JOIN on what condition?
- WHERE which rows?
- GROUP BY which column?
- HAVING which aggregate condition?
- ORDER BY which column?

Write the query in that order. Then check for NULL behaviour and aggregate rules. A query that runs is not necessarily the query the question asked for.

## Networks and concepts

For networking, learn the definitions with a diagram:

- star, bus, ring and mesh topologies;
- LAN, WAN and MAN;
- IP address versus MAC address;
- common protocols and what they do;
- basic security terms such as firewall and encryption.

Do not memorise a list of acronyms without the function. CUET options often swap the function while keeping the acronym.

## Weekly loop

- **Three days** — Python tracing and ten MCQs.
- **Two days** — SQL queries and database concepts.
- **One day** — networks and Boolean/number-system drills.
- **One day** — timed paper and review.

The [computer science subject hub](/cuet-mock-test/computer-science) lists the available papers. The [2024 shift 1 paper](/cuet-ug-previous-year-question-papers/domain-subject-pyqs/computer-science/computer-science-2024-07-19-shift-1) is a good timed attempt.

## Traps that cost marks

- Assuming a list is copied when it is referenced.
- Forgetting that range excludes the upper bound.
- Mixing WHERE and HAVING.
- Confusing a protocol with the layer it belongs to.
- Ignoring indentation in a nested block.

The [error log guide](/blog/cuet-ug-error-log-guide) helps tag whether an error came from a language rule or a logic slip. In Computer Science, those are different drills.`,
  },
];
