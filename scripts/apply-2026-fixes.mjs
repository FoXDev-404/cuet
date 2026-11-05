import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PAPERS_DIR = "public/local-papers/papers";

function updatePaper(fileName, modifier) {
  const filePath = join(PAPERS_DIR, fileName);
  const data = JSON.parse(readFileSync(filePath, "utf8"));
  modifier(data);
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(`[OK] Updated ${fileName}`);
}

// 1. chemistry-2026-05-26-shift-1.json
updatePaper("chemistry-2026-05-26-shift-1.json", (data) => {
  const questions = data.exam?.questions || data.questions;
  const q7 = questions.find(q => (q.sourceQuestionNo || q.number) === 7);
  if (q7) {
    q7.stemEn = `Given below are two statements:\n\nStatement I: Among\n\n $$ [\\mathrm{Cu(NH_{3})_{4}}]^{2+}, [\\mathrm{Ni(CN)_{4}}]^{2-}, [\\mathrm{Ni(NH_{3})_{6}}]^{2+} \\text{ and } [\\mathrm{Mn(H_{2}O)_{6}}]^{2+}, $$ \n\n $[\\mathrm{Mn}(\\mathrm{H}_{2}\\mathrm{O})_{6}]^{2+}$ has the maximum number of unpaired electrons.\n\nStatement II: The number of pairs among\n\n $$ [\\mathrm{NiCl}_{4}]^{2-}, [\\mathrm{Ni(CO)}_{4}] $$ \n\nand\n\n $$ [\\mathrm{Ni(CN)}_{4}]^{2-}, [\\mathrm{Ni(H_{2}O)}_{6}]^{2+} $$ \n\nthat contain only diamagnetic species is two.\n\nIn the light of the above statements, choose the correct answer from the options given below:`;
    q7.optionsEn = [
      { id: "A", text: "Statement I is false but Statement II is true" },
      { id: "B", text: "Both Statement I and Statement II are true" },
      { id: "C", text: "Both Statement I and Statement II are false" },
      { id: "D", text: "Statement I is true but Statement II is false" }
    ];
    q7.correctAnswer = "B";
    q7.reviewStatus = "keyed";
  }
});

// 2. english-2026-05-11-shift-1.json
updatePaper("english-2026-05-11-shift-1.json", (data) => {
  const questions = data.exam?.questions || data.questions;
  for (const q of questions) {
    const no = q.sourceQuestionNo || q.number;
    if (no === 8) {
      q.optionsEn[3].text = "Flawless";
      q.correctAnswer = "C";
      q.reviewStatus = "keyed";
      q.reviewFlags = [];
    } else if (no === 25) {
      q.optionsEn[3].text = "coax";
      q.correctAnswer = "A";
      q.reviewStatus = "keyed";
      q.reviewFlags = [];
    } else if (no === 49) {
      q.optionsEn[3].text = "To take down or dismantle";
      q.correctAnswer = "C";
      q.reviewStatus = "keyed";
      q.reviewFlags = [];
    } else if (no === 50) {
      q.optionsEn[3].text = "Students";
      q.correctAnswer = "B";
      q.reviewStatus = "keyed";
      q.reviewFlags = [];
    }
  }
});

// 3. english-2026-05-21-shift-1.json
updatePaper("english-2026-05-21-shift-1.json", (data) => {
  const questions = data.exam?.questions || data.questions;
  const q5 = questions.find(q => (q.sourceQuestionNo || q.number) === 5);
  if (q5) {
    q5.stemEn = "Fill in the blank with the correct option:\n\nThe church bells began to ___ loudly at noon.";
    q5.correctAnswer = "B";
    q5.reviewStatus = "keyed";
  }
});

// 4. english-2026-05-26-shift-2.json
updatePaper("english-2026-05-26-shift-2.json", (data) => {
  const questions = data.exam?.questions || data.questions;
  const q4 = questions.find(q => (q.sourceQuestionNo || q.number) === 4);
  if (q4) {
    q4.stemEn = "One Word Substitution: Identify the correct terms for the following two definitions respectively:\n\n1. The study and analysis of handwriting.\n2. An instrument that records heart/beat action.";
    q4.optionsEn = [
      { id: "A", text: "Numismatics, Stethoscope" },
      { id: "B", text: "Graphology, Cardiograph" },
      { id: "C", text: "Ventriloquism, Cardiograph" },
      { id: "D", text: "Graphology, Stethoscope" }
    ];
    q4.correctAnswer = "B";
    q4.reviewStatus = "keyed";
  }
});

// 5. english-2026-05-27-shift-1.json
updatePaper("english-2026-05-27-shift-1.json", (data) => {
  const questions = data.exam?.questions || data.questions;
  const q10 = questions.find(q => (q.sourceQuestionNo || q.number) === 10);
  if (q10) {
    q10.optionsEn[3].text = "A government officer";
    q10.correctAnswer = "B";
    q10.reviewStatus = "keyed";
    q10.reviewFlags = [];
  }
});

// 6. general-test-2026-05-30-shift-1.json
updatePaper("general-test-2026-05-30-shift-1.json", (data) => {
  const questions = data.exam?.questions || data.questions;
  const q15 = questions.find(q => (q.sourceQuestionNo || q.number) === 15);
  if (q15) {
    q15.stemEn = "A cone of radius 9 cm and height 15 cm is melted and made into a cylinder of height 45 cm. The diameter of the cylinder is:";
    q15.correctAnswer = "D";
    q15.reviewStatus = "keyed";
  }
});

// 7. general-test-2026-06-06-shift-1.json
updatePaper("general-test-2026-06-06-shift-1.json", (data) => {
  const questions = data.exam?.questions || data.questions;
  const q6 = questions.find(q => (q.sourceQuestionNo || q.number) === 6);
  if (q6) {
    q6.stemEn = "Find the smallest number which should be added to the smallest number divisible by 6, 9 and 15 to make it a perfect square.";
    q6.optionsEn = [
      { id: "A", text: "10" },
      { id: "B", text: "9" },
      { id: "C", text: "19" },
      { id: "D", text: "21" }
    ];
    q6.correctAnswer = "A";
    q6.reviewStatus = "keyed";
  }
});

// 8. geography-2026-05-11-shift-1.json
updatePaper("geography-2026-05-11-shift-1.json", (data) => {
  const questions = data.exam?.questions || data.questions;
  
  // Q2
  const q2 = questions.find(q => (q.sourceQuestionNo || q.number) === 2);
  if (q2) {
    q2.stemEn = "Which of the following is the correct chronological sequence of the 'Evolution of Geography'?\n\n1. Spatial Organisation\n2. Emergence of Humanistic, Radical and Behavioural schools\n3. Regional analysis\n4. Post-modernism in Geography\n\nChoose the correct answer from the options given below:";
    q2.optionsEn = [
      { id: "A", text: "3, 1, 2, 4" },
      { id: "B", text: "1, 3, 2, 4" },
      { id: "C", text: "3, 2, 1, 4" },
      { id: "D", text: "2, 3, 1, 4" }
    ];
    q2.correctAnswer = "A";
    q2.reviewStatus = "keyed";
    q2.reviewFlags = [];
  }

  // Insert Q3 if missing
  let q3 = questions.find(q => (q.sourceQuestionNo || q.number) === 3);
  if (!q3) {
    q3 = {
      id: "q03",
      sourceQuestionNo: 3,
      stemEn: "Given below are two statements: one is labelled as Statement I and the other is labelled as Statement II.\n\nStatement I: The Demographic Transition Theory helps us predict the future population of any area.\n\nStatement II: In the first stage, fertility is high but mortality is low due to medical advancements.\n\nChoose the correct answer from the options given below:",
      optionsEn: [
        { id: "A", text: "Both Statements are correct." },
        { id: "B", text: "Statement I is correct, Statement II is incorrect." },
        { id: "C", text: "Statement I is incorrect, Statement II is correct." },
        { id: "D", text: "Both Statements are incorrect." }
      ],
      optionsAreImages: false,
      correctAnswer: "B",
      explanationEn: null,
      passageId: null,
      reviewStatus: "keyed",
      reviewFlags: [],
      sourcePages: [1],
      assets: []
    };
    const idx2 = questions.findIndex(q => (q.sourceQuestionNo || q.number) === 2);
    questions.splice(idx2 + 1, 0, q3);
  }

  // Q4
  const q4 = questions.find(q => (q.sourceQuestionNo || q.number) === 4);
  if (q4) {
    q4.stemEn = "Arrange the following continents in descending order of their population growth rate (2010–15):\n\n1. Asia\n2. Africa\n3. Latin America\n4. Europe\n\nChoose the correct answer from the options given below:";
    q4.optionsEn = [
      { id: "A", text: "2, 3, 1, 4" },
      { id: "B", text: "2, 1, 3, 4" },
      { id: "C", text: "1, 2, 3, 4" },
      { id: "D", text: "3, 2, 1, 4" }
    ];
    q4.correctAnswer = "A";
    q4.reviewStatus = "keyed";
    q4.reviewFlags = [];
  }
});

// 9. geography-2026-05-14-shift-1.json
updatePaper("geography-2026-05-14-shift-1.json", (data) => {
  const questions = data.exam?.questions || data.questions;

  // Q2
  const q2 = questions.find(q => (q.sourceQuestionNo || q.number) === 2);
  if (q2) {
    q2.stemEn = "Which of the following factors affects the rural settlement patterns?\n\n1. Water Supply\n2. Upland (dry points)\n3. Building Material\n4. Planned Settlements\n\nChoose the correct answer from the options given below:";
    q2.optionsEn = [
      { id: "A", text: "1 and 2" },
      { id: "B", text: "1, 2, and 3" },
      { id: "C", text: "All of the above" },
      { id: "D", text: "1, 2, and 4" }
    ];
    q2.correctAnswer = "C";
    q2.reviewStatus = "keyed";
    q2.reviewFlags = [];
  }

  // Insert Q3
  let q3 = questions.find(q => (q.sourceQuestionNo || q.number) === 3);
  if (!q3) {
    q3 = {
      id: "q03",
      sourceQuestionNo: 3,
      stemEn: "Statement I: Megalopolis is a Greek word meaning 'Great City'.\n\nStatement II: The term was popularized by Jean Gottman in 1957.\n\nChoose the correct answer from the options given below:",
      optionsEn: [
        { id: "A", text: "Both are correct." },
        { id: "B", text: "Statement I is correct, II is wrong." },
        { id: "C", text: "Statement I is wrong, II is correct." },
        { id: "D", text: "Both are wrong." }
      ],
      optionsAreImages: false,
      correctAnswer: "A",
      explanationEn: null,
      passageId: null,
      reviewStatus: "keyed",
      reviewFlags: [],
      sourcePages: [1],
      assets: []
    };
    const idx2 = questions.findIndex(q => (q.sourceQuestionNo || q.number) === 2);
    questions.splice(idx2 + 1, 0, q3);
  }

  // Q4
  const q4 = questions.find(q => (q.sourceQuestionNo || q.number) === 4);
  if (q4) {
    q4.stemEn = "Match the Census definition of Urban Areas in India (2011):\n\n1. Minimum Population: 5,000\n2. Non-Agri workers: 75%\n3. Density: 400 persons/sq km\n\nWhich of the above are correct criteria?";
    q4.optionsEn = [
      { id: "A", text: "1 and 2" },
      { id: "B", text: "2 and 3" },
      { id: "C", text: "1 and 3" },
      { id: "D", text: "1, 2, and 3" }
    ];
    q4.correctAnswer = "D";
    q4.reviewStatus = "keyed";
    q4.reviewFlags = [];
  }

  // Q5
  const q5 = questions.find(q => (q.sourceQuestionNo || q.number) === 5);
  if (q5) {
    q5.optionsEn[3].text = "Kolkata";
    q5.correctAnswer = "C";
    q5.reviewStatus = "keyed";
    q5.reviewFlags = [];
  }
});

// 10. geography-2026-05-21-shift-1.json
updatePaper("geography-2026-05-21-shift-1.json", (data) => {
  const questions = data.exam?.questions || data.questions;

  // Q2
  const q2 = questions.find(q => (q.sourceQuestionNo || q.number) === 2);
  if (q2) {
    q2.stemEn = "Consider the following statements regarding the phases of population growth in India:\n\n1. The period between 1901 and 1921 is referred to as a period of stagnant or stationary phase of growth.\n2. The period between 1921 and 1951 is referred to as the period of steady population growth.\n3. The decades 1951-1981 are referred to as the period of population explosion in India.\n4. After 1981 till present, the crude birth rate has started increasing rapidly.\n\nWhich of the statements given above are correct?";
    q2.optionsEn = [
      { id: "A", text: "1 and 3 only" },
      { id: "B", text: "1, 2 and 3 only" },
      { id: "C", text: "2, 3 and 4 only" },
      { id: "D", text: "1, 2, 3 and 4" }
    ];
    q2.correctAnswer = "B";
    q2.reviewStatus = "keyed";
    q2.reviewFlags = [];
  }

  // Insert Q3
  let q3 = questions.find(q => (q.sourceQuestionNo || q.number) === 3);
  if (!q3) {
    q3 = {
      id: "q03",
      sourceQuestionNo: 3,
      stemEn: "The Integrated Tribal Development Project (ITDP) in Barmour region belongs to which state?",
      optionsEn: [
        { id: "A", text: "Himachal Pradesh" },
        { id: "B", text: "Uttarakhand" },
        { id: "C", text: "Jammu and Kashmir" },
        { id: "D", text: "Arunachal Pradesh" }
      ],
      optionsAreImages: false,
      correctAnswer: "A",
      explanationEn: null,
      passageId: null,
      reviewStatus: "keyed",
      reviewFlags: [],
      sourcePages: [1],
      assets: []
    };
    const idx2 = questions.findIndex(q => (q.sourceQuestionNo || q.number) === 2);
    questions.splice(idx2 + 1, 0, q3);
  }

  // Q4
  const q4 = questions.find(q => (q.sourceQuestionNo || q.number) === 4);
  if (q4) {
    q4.stemEn = "Consider the following statements regarding Human Settlements in India:\n\n1. Clustered settlements are distinctively found in the fertile alluvial plains and the northeastern states.\n2. Semi-clustered settlements may result from the segregation or fragmentation of a large compact village.\n3. Hamleted settlements are locally called Panna, Para, Palli, Nagla, or Dhani in different parts of the country.\n4. Dispersed settlements appear in the form of isolated huts in remote jungles or hills.\n\nWhich of the statements given above are correct?";
    q4.optionsEn = [
      { id: "A", text: "1 and 4 only" },
      { id: "B", text: "2 and 3 only" },
      { id: "C", text: "1, 3 and 4 only" },
      { id: "D", text: "1, 2, 3 and 4" }
    ];
    q4.correctAnswer = "D";
    q4.reviewStatus = "keyed";
    q4.reviewFlags = [];
  }
});

// 11. history-2026-05-29-shift-2.json
updatePaper("history-2026-05-29-shift-2.json", (data) => {
  const questions = data.exam?.questions || data.questions;

  // Insert Q1, Q2, Q3
  let q1 = questions.find(q => (q.sourceQuestionNo || q.number) === 1);
  if (!q1) {
    q1 = {
      id: "q01",
      sourceQuestionNo: 1,
      stemEn: "Arrange the following national movements in chronological order:\n\n1. Non-Cooperation Movement\n2. Civil Disobedience Movement\n3. Swadeshi Movement\n4. Quit India Movement\n\nChoose the correct answer from the options given below:",
      optionsEn: [
        { id: "A", text: "3, 1, 2, 4" },
        { id: "B", text: "2, 3, 1, 4" },
        { id: "C", text: "3, 2, 1, 4" },
        { id: "D", text: "2, 1, 3, 4" }
      ],
      optionsAreImages: false,
      correctAnswer: "A",
      explanationEn: null,
      passageId: null,
      reviewStatus: "keyed",
      reviewFlags: [],
      sourcePages: [1],
      assets: []
    };
  }

  let q2 = questions.find(q => (q.sourceQuestionNo || q.number) === 2);
  if (!q2) {
    q2 = {
      id: "q02",
      sourceQuestionNo: 2,
      stemEn: "Who among the following gave the slogan “Do or Die” during the Indian National Movement?",
      optionsEn: [
        { id: "A", text: "Subhas Chandra Bose" },
        { id: "B", text: "Jawaharlal Nehru" },
        { id: "C", text: "Mahatma Gandhi" },
        { id: "D", text: "Bal Gangadhar Tilak" }
      ],
      optionsAreImages: false,
      correctAnswer: "C",
      explanationEn: null,
      passageId: null,
      reviewStatus: "keyed",
      reviewFlags: [],
      sourcePages: [1],
      assets: []
    };
  }

  let q3 = questions.find(q => (q.sourceQuestionNo || q.number) === 3);
  if (!q3) {
    q3 = {
      id: "q03",
      sourceQuestionNo: 3,
      stemEn: "The Cabinet Mission came to India in:",
      optionsEn: [
        { id: "A", text: "1940" },
        { id: "B", text: "1942" },
        { id: "C", text: "1945" },
        { id: "D", text: "1946" }
      ],
      optionsAreImages: false,
      correctAnswer: "D",
      explanationEn: null,
      passageId: null,
      reviewStatus: "keyed",
      reviewFlags: [],
      sourcePages: [1],
      assets: []
    };
  }

  // Q4
  const q4 = questions.find(q => (q.sourceQuestionNo || q.number) === 4);
  if (q4) {
    q4.stemEn = "Which among the following Acts introduced the system of Dyarchy in the provinces?";
    q4.optionsEn = [
      { id: "A", text: "Government of India Act, 1909" },
      { id: "B", text: "Government of India Act, 1919" },
      { id: "C", text: "Government of India Act, 1935" },
      { id: "D", text: "Indian Councils Act, 1892" }
    ];
    q4.correctAnswer = "B";
    q4.reviewStatus = "keyed";
    q4.reviewFlags = [];
  }

  // Re-assemble questions in order 1..10
  const remaining = questions.filter(q => (q.sourceQuestionNo || q.number) >= 4);
  data.exam.questions = [q1, q2, q3, ...remaining];
});

// 12. mathematics-2026-05-19-shift-1.json
updatePaper("mathematics-2026-05-19-shift-1.json", (data) => {
  const questions = data.exam?.questions || data.questions;

  // Q4
  const q4 = questions.find(q => (q.sourceQuestionNo || q.number) === 4);
  if (q4) {
    q4.stemEn = "Evaluate:\n\n $$ \\int\\frac{x^{2}+1}{x^{4}+1}dx $$";
    q4.optionsEn = [
      { id: "A", text: "$ \\frac{1}{\\sqrt{2}}\\tan^{-1}\\left(\\frac{x^{2}-1}{\\sqrt{2}x}\\right)+C $" },
      { id: "B", text: "$ \\tan^{-1}x+C $" },
      { id: "C", text: "$ \\frac{1}{2}\\ln(x^{2}+1)+C $" },
      { id: "D", text: "$ \\frac{x}{x^{2}+1}+C $" }
    ];
    q4.correctAnswer = "A";
    q4.reviewStatus = "keyed";
    q4.reviewFlags = [];
  }

  // Q10
  const q10 = questions.find(q => (q.sourceQuestionNo || q.number) === 10);
  if (q10) {
    q10.optionsEn[0].text = "$$ y\\left[\\sec^{2}x\\sin x\\ln x+\\tan x\\cos x\\ln x+\\frac{\\tan x\\sin x}{x}\\right] $$";
    q10.correctAnswer = "A";
    q10.reviewStatus = "keyed";
  }
});

// 13. mathematics-2026-05-20-shift-1.json
updatePaper("mathematics-2026-05-20-shift-1.json", (data) => {
  const questions = data.exam?.questions || data.questions;
  const q62 = questions.find(q => (q.sourceQuestionNo || q.number) === 62);
  if (q62) {
    q62.optionsEn[3].text = "$$ \\begin{bmatrix} 2 & 6 \\\\ 2 & 11/2 \\end{bmatrix} $$";
    q62.correctAnswer = "A";
    q62.reviewStatus = "keyed";
  }
});

