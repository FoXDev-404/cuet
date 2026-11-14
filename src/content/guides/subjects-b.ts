import type { StaticGuide } from "./types";

/**
 * Subject guides, part two. These subjects reward different kinds of recall:
 * timelines for History, institutions for Political Science, maps for
 * Geography, theories for Psychology, structures for Sociology, and applied
 * reasoning for Legal Studies.
 */
export const SUBJECT_GUIDES_B: StaticGuide[] = [
  {
    slug: "cuet-ug-history-preparation-guide",
    title: "CUET History Preparation: Themes, Sources and Recall",
    description:
      "A CUET History study plan built around themes rather than isolated facts, with source-based question practice, timeline recall and weekly timed papers.",
    category: "subject-strategy",
    publishedAt: "2026-09-22",
    updatedAt: "2026-11-02",
    body: `History is not a list of dates. It is a set of arguments about change, and the dates are the skeleton that holds the arguments together. CUET History rewards students who can place an event in its theme, not students who memorise the largest number of facts.

The paper draws on themes from Indian history and world history. Each theme has its own vocabulary, sources and turning points.

## Study by theme, not by page

For each theme, build a one-page frame:

- **Period and place** — when and where the theme unfolds.
- **Key actors** — rulers, movements, groups, ideas.
- **Turning points** — three to five events that change the direction.
- **Sources** — what kind of evidence historians use: inscriptions, coins, chronicles, oral accounts, colonial records.
- **One argument** — what the theme is trying to explain.

This frame is more useful than a chronological list because CUET questions often ask about significance, not just sequence.

## Timeline recall

Dates matter, but only the ones that anchor a theme. Do not try to memorise every year in the textbook.

- Build a timeline with ten to fifteen anchor dates per theme.
- Write the date, the event and one consequence.
- Test yourself by covering the event column and reciting it from the date.
- Rebuild the timeline from memory once a week.

A timeline you can reconstruct is more reliable than one you can recognise.

## Source-based questions

A source extract asks you to read like a historian:

1. Identify the type of source and its author or perspective.
2. Note what the source claims and what it assumes.
3. Match the extract to the theme, not to a random fact.
4. Eliminate options that go beyond what the source says.

The most common trap is choosing an option that is historically true but not supported by the extract. The question asks about the source, not about your general knowledge.

## Recall without re-reading

Use three retrieval drills:

- **Name the theme** from five keywords.
- **Explain the significance** of an event in two sentences.
- **Compare two movements or periods** on three points.

These drills expose the difference between recognition and recall. If you can only recognise the term when you see it, you cannot answer an application question.

## Weekly loop

- **Three days** — one theme frame and ten MCQs.
- **Two days** — timeline and source practice.
- **One day** — timed sectional.
- **One day** — full paper or review.

The [history subject hub](/cuet-mock-test/history) lists the available sets. The [2025 shift 1 paper](/cuet-ug-previous-year-question-papers/domain-subject-pyqs/history/history-2025-05-16-shift-1) is a good timed attempt after two themes are framed.

## Traps that cost marks

- Memorising dates without the significance.
- Answering from general knowledge instead of the source.
- Confusing two movements with similar names.
- Treating a theme's example as its main argument.

The [syllabus page](/cuet-ug-syllabus) lists the themes in scope, and the [error log guide](/blog/cuet-ug-error-log-guide) helps separate a timeline gap from a source-reading error.`,
  },
  {
    slug: "cuet-ug-political-science-preparation-guide",
    title: "CUET Political Science: Concepts, Maps and Practice",
    description:
      "CUET Political Science: compare institutions and ideologies, connect contemporary world politics to India, and practise assertion-style questions.",
    category: "subject-strategy",
    publishedAt: "2026-09-26",
    updatedAt: "2026-11-02",
    body: `Political Science in CUET is a subject of comparisons. Institutions are compared, ideologies are contrasted, and events are explained through interests and power. Students who memorise isolated definitions often freeze when the question asks them to choose between two plausible interpretations.

The fix is to study in pairs and structures.

## The two halves of the paper

The syllabus usually moves between two broad areas:

- **Contemporary world politics** — the Cold War and its aftermath, regional organisations, the United Nations, globalisation and security.
- **Politics in India since independence** — the Constitution, planning, parties, federalism, emergencies, coalitions and social movements.

The current unit list is on the [syllabus page](/cuet-ug-syllabus). For each unit, identify the central tension: integration versus sovereignty, equality versus liberty, stability versus change.

## Compare, do not list

For every institution or idea, write a comparison frame:

- What problem does it solve?
- Who holds power?
- What are its strengths?
- What is the main criticism?
- One example from India or world politics.

For example, compare the UN Security Council with the General Assembly on membership, decision-making and enforcement. A comparison makes the options easier to discriminate.

## Connect world politics to India

A question about non-alignment, globalisation or regional organisations often expects an Indian example. Keep a short list of connections:

- India and the Non-Aligned Movement;
- India and the United Nations;
- India and regional organisations;
- India and the global economy after liberalisation.

Do not invent dates or treaty details. If you are unsure, answer from the textbook's framing rather than from a news headline.

## Assertion and reason questions

These questions test the relationship between two statements, not just their truth.

1. Decide whether the assertion is true.
2. Decide whether the reason is true.
3. Ask whether the reason explains the assertion.
4. Choose the option that matches both answers.

A common error is to mark both statements true and assume the reason explains the assertion. Sometimes it is true but unrelated.

## Weekly loop

- **Three days** — one unit, comparison frame, ten MCQs.
- **Two days** — assertion-reason and map or institution drills.
- **One day** — timed sectional.
- **One day** — full paper or review.

The [political science subject hub](/cuet-mock-test/political-science) lists the available papers. The [2024 shift 2 paper](/cuet-ug-previous-year-question-papers/domain-subject-pyqs/political-science/political-science-2024-05-18-shift-2) is a useful timed attempt.

## Traps that cost marks

- Confusing the roles of similar institutions.
- Treating a true statement as the answer even when it does not explain the assertion.
- Answering from current affairs instead of the syllabus frame.
- Mixing the Indian and world halves of the paper.

The [error log guide](/blog/cuet-ug-error-log-guide) helps separate a concept gap from an assertion-reason logic error.`,
  },
  {
    slug: "cuet-ug-geography-preparation-guide",
    title: "CUET Geography Preparation: Maps, Data and Concepts",
    description:
      "A CUET Geography plan that balances map work, physical and human geography concepts, and data interpretation with weekly previous-year practice.",
    category: "subject-strategy",
    publishedAt: "2026-09-30",
    updatedAt: "2026-11-02",
    body: `Geography is the CUET subject where a diagram or a map can answer a question faster than a paragraph. The paper mixes physical geography, human geography and the geography of India, and it expects you to move between scales without losing the concept.

Students who only read the chapter often struggle with map-based and data-based questions. Those need separate practice.

## The three lenses

- **Physical geography** — landforms, climate, water, soils and vegetation.
- **Human geography** — population, migration, settlements, economic activities and transport.
- **India: people and economy** — resources, agriculture, industry, planning and regional development.

The current unit list is on the [syllabus](/cuet-ug-syllabus). For each unit, ask: what is the process, where does it happen, and why there?

## Map work

Maps are not optional. Keep a blank outline map and practise:

- locating physical features: rivers, mountains, plateaus, coasts;
- locating states and major cities;
- marking resource regions and industrial centres;
- drawing the direction of winds, currents or migration.

After drawing, label from memory and check. A map you have drawn once is easier to recall than a map you have only seen.

## Data interpretation

Geography questions often include a table, graph or map with a question about trend or comparison.

Use this order:

1. Read the title and the units.
2. Identify the highest and lowest values.
3. Describe the trend in one sentence.
4. Only then look at the options.

Do not calculate more than the question asks. Many data questions are about direction, not precise values.

## Concept pairs

Keep a page of pairs that are easy to confuse:

- weather and climate;
- push and pull factors;
- primary and secondary activities;
- growth and development;
- density and distribution.

Write the difference in one line and one example. Review the page twice a week.

## Weekly loop

- **Three days** — one unit, one map, ten MCQs.
- **Two days** — data interpretation and previous-year questions.
- **One day** — timed sectional.
- **One day** — full paper or review.

The [geography subject hub](/cuet-mock-test/geography) lists the available sets. The [2025 shift 1 paper](/cuet-ug-previous-year-question-papers/domain-subject-pyqs/geography/geography-2025-05-16-shift-1) is a good timed attempt.

## Traps that cost marks

- Reading a map without checking the direction or scale.
- Confusing a cause with a consequence.
- Answering a data question from memory instead of the given figure.
- Mixing Indian and world examples.

The [error log guide](/blog/cuet-ug-error-log-guide) helps tag map errors separately from concept errors. They need different practice.`,
  },
  {
    slug: "cuet-ug-psychology-preparation-guide",
    title: "CUET Psychology Preparation: Theories and Application",
    description:
      "How to prepare CUET Psychology: build a theory map, learn the difference between similar concepts, and practise application questions from previous papers.",
    category: "subject-strategy",
    publishedAt: "2026-10-04",
    updatedAt: "2026-11-02",
    body: `Psychology is a subject of theories and applications. The paper expects you to know who proposed a concept, what it predicts, and how it shows up in a real situation. A definition alone is rarely enough.

The students who score well are not the ones who memorise the most names. They are the ones who can tell similar theories apart and apply the right one to a short scenario.

## The theory map

For every major theory, record five things:

- **Theorist or school** — who proposed it.
- **Core claim** — what it says about behaviour or mind.
- **Key terms** — the vocabulary the question will use.
- **One example** — a situation that illustrates it.
- **One limitation or criticism** — what the theory does not explain.

This map prevents the most common error: attributing a correct idea to the wrong theorist.

## Distinguish similar concepts

Psychology options are often designed around near-neighbours:

- attitude and behaviour;
- stress and anxiety;
- intelligence and aptitude;
- prejudice and discrimination;
- repression and suppression.

Write the difference in one line, then write an example that could only belong to one of them. If the example fits both, it is not a good discriminator.

## Application questions

A scenario question asks which concept best explains the situation. Use this order:

1. Read the question stem to see what is being asked.
2. Underline the behaviour, emotion or cognition in the scenario.
3. Name the concept before looking at the options.
4. Choose the option that matches the concept, not the most familiar word.

If two options are close, the correct one usually uses the precise term from the chapter. The distractor is often a related concept applied too broadly.

## Recall drills

- **Name the theorist** from a definition.
- **Name the stage or type** from an example.
- **Explain the difference** between two paired concepts.
- **Give one real-life example** for a theory without using the textbook example.

The last drill is the hardest and the most useful.

## Weekly loop

- **Three days** — one unit, theory map, ten MCQs.
- **Two days** — paired-concept drills and application questions.
- **One day** — timed sectional.
- **One day** — full paper or review.

The [psychology subject hub](/cuet-mock-test/psychology) lists the available papers. The [2024 shift 1 paper](/cuet-ug-previous-year-question-papers/domain-subject-pyqs/psychology/psychology-2024-07-19-shift-1) is a good timed attempt.

## Traps that cost marks

- Matching a theory to the wrong theorist.
- Choosing a broad concept when the scenario describes a specific one.
- Confusing a disorder with a symptom.
- Answering from everyday opinion instead of the chapter's framework.

The [error log guide](/blog/cuet-ug-error-log-guide) helps separate a theory gap from a scenario-reading error.`,
  },
  {
    slug: "cuet-ug-sociology-preparation-guide",
    title: "CUET Sociology Preparation: Think in Structures",
    description:
      "A CUET Sociology plan focused on thinkers, concepts and Indian social change, with comparison frames, definition drills and timed previous-year practice.",
    category: "subject-strategy",
    publishedAt: "2026-10-16",
    updatedAt: "2026-11-02",
    body: `Sociology asks you to look past individual choices and see the structures that shape them. That is the subject's central move, and it is also the main reason students lose marks: they answer from common sense instead of from a sociological concept.

The paper rewards precise concepts, clear comparisons and an understanding of Indian society.

## The two anchors

Most CUET Sociology questions sit between two anchors:

- **Structure** — caste, class, tribe, family, kinship, gender, education and economy.
- **Change** — colonialism, nationalism, industrialisation, urbanisation, social movements and reform.

For each topic, ask: what structure is being described, and what change is acting on it?

## Thinkers and concepts

Keep a thinker map:

- the thinker's central question;
- the concept they are known for;
- one example from Indian society;
- one criticism.

Do not memorise quotations. Memorise the argument and the vocabulary. A question rarely asks "what did X say?" It asks which concept explains a situation.

## Comparison frames

Sociology is full of pairs that need contrast:

- caste and class;
- community and association;
- formal and informal social control;
- achieved and ascribed status;
- social change and social mobility.

Write each pair as a three-point contrast: basis, example, and what it explains. This is more useful than a definition list because the exam often asks you to distinguish them.

## Indian society examples

Use examples from the NCERT text, not from anecdotes. For each theme, keep two examples:

- one historical or policy example;
- one everyday example that illustrates the same structure.

If you cannot connect the concept to an example, you probably cannot apply it in a scenario.

## Weekly loop

- **Three days** — one theme, thinker map, ten MCQs.
- **Two days** — comparison frames and definition drills.
- **One day** — timed sectional.
- **One day** — full paper or review.

The [sociology subject hub](/cuet-mock-test/sociology) lists the available papers. The [2024 shift 3 paper](/cuet-ug-previous-year-question-papers/domain-subject-pyqs/sociology/sociology-2024-05-18-shift-3) is a good timed attempt.

## Traps that cost marks

- Answering from personal opinion instead of a sociological concept.
- Treating caste, class and tribe as interchangeable.
- Confusing a thinker's concept with a neighbouring one.
- Using an example that illustrates a different structure.

The [syllabus page](/cuet-ug-syllabus) lists the themes, and the [error log guide](/blog/cuet-ug-error-log-guide) helps separate a concept gap from a common-sense answer.`,
  },
  {
    slug: "cuet-ug-legal-studies-guide",
    title: "CUET Legal Studies: Read, Reason and Apply",
    description:
      "A CUET Legal Studies plan for scenario questions: sources of law, constitutional rights, civil and criminal basics, and a weekly reasoning drill.",
    category: "subject-strategy",
    publishedAt: "2026-10-18",
    updatedAt: "2026-11-02",
    body: `Legal Studies is a reasoning subject before it is a memory subject. The paper gives you a short situation and asks which legal idea applies. Knowing the definition is necessary, but the marks are in applying it to the facts.

The available practice sets are limited, so each attempt should be reviewed carefully.

## What the paper covers

The syllabus usually includes:

- the Indian legal system and sources of law;
- the Constitution, rights and duties;
- basic civil and criminal law concepts;
- contract and tort principles;
- consumer protection and human rights.

The current unit list is on the [syllabus page](/cuet-ug-syllabus). Use it as the boundary; law is a wide field and the paper is not a law-school entrance exam.

## Read the facts, then name the issue

For every scenario question:

1. Identify the people and their relationship.
2. Identify the harm, dispute or right in question.
3. Name the legal issue in one phrase.
4. Choose the option that applies the rule to these facts.

Do not choose an option because it states a true legal principle. It must also fit the facts.

## Sources of law

Keep the hierarchy clear:

- the Constitution;
- legislation;
- subordinate legislation;
- judicial decisions;
- customary law.

A question may ask which source applies or which source is supreme. The answer usually follows the hierarchy, not the most recent news story.

## Rights and duties

Learn rights as pairs:

- right and corresponding duty;
- fundamental rights and directive principles;
- legal rights and moral rights;
- civil rights and human rights.

For each pair, write one example and one limit. A right is rarely absolute; the limits are where the questions live.

## Contract and tort basics

- **Contract:** offer, acceptance, consideration, capacity, free consent and legality.
- **Tort:** duty, breach, causation and harm.

For a contract question, check whether all elements are present. For a tort question, check whether the harm was reasonably foreseeable. These checklists make scenario questions manageable.

## Weekly loop

- **Three days** — one unit, ten definition and scenario questions.
- **Two days** — previous-year questions and reasoning drills.
- **One day** — timed sectional.
- **One day** — review and error log.

The [legal studies subject hub](/cuet-mock-test/legal-studies) lists the available paper. The [2022 paper](/cuet-ug-previous-year-question-papers/domain-subject-pyqs/legal-studies/legal-studies-2022) is the starting point.

## Traps that cost marks

- Confusing civil and criminal matters.
- Treating a fundamental right as absolute.
- Choosing a true statement that does not fit the facts.
- Mixing a legal duty with a moral duty.

The [error log guide](/blog/cuet-ug-error-log-guide) helps tag whether an error was a definition gap or a fact-application error.`,
  },
  {
    slug: "cuet-ug-hindi-preparation-guide",
    title: "CUET Hindi Paper: Reading, Grammar and Vocabulary",
    description:
      "A CUET Hindi language plan covering अपठित गद्यांश, पद्यांश, व्याकरण and शब्द भंडार, with a daily one-hour loop and timed previous-year practice.",
    category: "subject-strategy",
    publishedAt: "2026-10-20",
    updatedAt: "2026-11-02",
    body: `The CUET Hindi paper is a language paper, not a literature paper. It tests how well you read, infer and use Hindi under a clock. Students who prepare it like a board exam — memorising chapters and author names — often find the paper unfamiliar.

The section rewards reading speed, vocabulary and grammar in context.

## What the paper asks

The recurring tasks are:

- **अपठित गद्यांश** — an unseen passage with comprehension questions.
- **अपठित पद्यांश** — a short poem or extract with meaning and inference questions.
- **व्याकरण** — grammar: संधि, समास, कारक, वाच्य, काल, वर्तनी and similar topics.
- **शब्द भंडार** — synonyms, antonyms, one-word substitutions, मुहावरे and लोकोक्तियाँ.

The exact unit list is on the [syllabus page](/cuet-ug-syllabus). Check it before making a grammar-only plan.

## Read the passage once for structure

Do not read the passage once per question. Read it once to find:

- the main idea;
- the tone;
- the paragraph that contains the argument;
- the examples.

Then answer from the map and return only to verify a detail. This is the same skill as the English paper, applied in Hindi.

For पद्यांश, read the extract twice: once for the literal meaning and once for the भावार्थ. Do not import a remembered poem's interpretation if the extract is unfamiliar.

## Grammar in context

Grammar questions are easier when you read the full sentence. A form that looks correct in isolation may break the sentence's tense or agreement.

- For संधि and समास, practise splitting and joining words.
- For कारक, identify the verb first, then the relation.
- For वाच्य, change the sentence and check whether the meaning survives.
- For वर्तनी, keep a list of the words you misspell and review it weekly.

Ten questions a day with a written reason beat a long grammar lecture.

## Vocabulary and मुहावरे

Do not learn word lists without sentences. When you meet a new word:

1. Write the sentence it appeared in.
2. Write the meaning in context.
3. Write one sentence of your own.

For मुहावरे and लोकोक्तियाँ, learn the meaning and one usage. A literal translation is usually the distractor.

## A one-hour daily loop

- **20 minutes** — one unseen passage with questions.
- **15 minutes** — vocabulary from that passage.
- **15 minutes** — grammar topic, alternating days.
- **10 minutes** — review wrong answers and note the reason.

Once a week, replace the loop with a full Hindi section. The [Hindi subject hub](/cuet-mock-test/hindi) lists the available sets, and the [2025 paper](/cuet-ug-previous-year-question-papers/language-pyqs/hindi/hindi-2025) is a recent timed attempt.

## Traps that cost marks

- Re-reading the passage for every question.
- Choosing a grammar form that sounds formal but breaks the sentence.
- Translating a मुहावरा literally.
- Confusing the poet's remembered meaning with the extract's actual meaning.

The [error log guide](/blog/cuet-ug-error-log-guide) works for Hindi too. Tag the error as passage, grammar, vocabulary or time pressure, and practise the largest bucket.`,
  },
];
