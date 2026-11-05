import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PAPERS_DIR = "public/local-papers/papers";

function styleTable(raw) {
  // Replace table style with clean border-collapse table
  return raw
    .replace(/<table[^>]*>/, '<table border="1" style="margin: auto; width: 100%; border-collapse: collapse; text-align: left;">')
    .replace(/<td[^>]*>/g, '<td style="padding: 8px; border: 1px solid #444;">')
    .replace(/<th[^>]*>/g, '<th style="padding: 8px; border: 1px solid #444;">');
}

// 1. Update chemistry-2025-05-23-shift-2.json
const chemFile = join(PAPERS_DIR, "chemistry-2025-05-23-shift-2.json");
const chem = JSON.parse(readFileSync(chemFile, "utf8"));
const chemQs = chem.exam?.questions || chem.questions;
const chemPassages = chem.exam?.passages || chem.passages;

// Clean Q28 (Rosenmund Match List table)
const q28 = chemQs.find(q => (q.sourceQuestionNo || q.number) === 28);
if (q28) {
  q28.stemEn = `Match List-I with List-II:\n\n<table border="1" style="margin: auto; width: 100%; border-collapse: collapse; text-align: left;">\n  <thead>\n    <tr style="background-color: rgba(255, 255, 255, 0.05);">\n      <th style="padding: 8px; border: 1px solid #444;">List-I (Reaction)</th>\n      <th style="padding: 8px; border: 1px solid #444;">List-II (Reagent / Description)</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <td style="padding: 8px; border: 1px solid #444;">(A) Rosenmund reduction</td>\n      <td style="padding: 8px; border: 1px solid #444;">(I) Nitrile reduced with $\\mathrm{SnCl_2 + HCl}$ followed by $\\mathrm{H_3O^+}$</td>\n    </tr>\n    <tr>\n      <td style="padding: 8px; border: 1px solid #444;">(B) Stephen reaction</td>\n      <td style="padding: 8px; border: 1px solid #444;">(II) Acyl chloride hydrogenated over $\\mathrm{Pd\\text{-}BaSO_4}$</td>\n    </tr>\n    <tr>\n      <td style="padding: 8px; border: 1px solid #444;">(C) Etard reaction</td>\n      <td style="padding: 8px; border: 1px solid #444;">(III) Oxidation of toluene with $\\mathrm{CrO_2Cl_2}$</td>\n    </tr>\n    <tr>\n      <td style="padding: 8px; border: 1px solid #444;">(D) Gattermann-Koch reaction</td>\n      <td style="padding: 8px; border: 1px solid #444;">(IV) Benzene treated with $\\mathrm{CO + HCl}$ in presence of anhyd. $\\mathrm{AlCl_3}$</td>\n    </tr>\n  </tbody>\n</table>`;
  q28.optionsEn = [
    { id: "A", text: "(A) - (I), (B) - (II), (C) - (III), (D) - (IV)" },
    { id: "B", text: "(A) - (II), (B) - (I), (C) - (III), (D) - (IV)" },
    { id: "C", text: "(A) - (I), (B) - (II), (C) - (IV), (D) - (III)" },
    { id: "D", text: "(A) - (III), (B) - (IV), (C) - (I), (D) - (II)" }
  ];
  q28.assets = [];
  q28.correctAnswer = "B";
  q28.reviewStatus = "keyed";
  q28.reviewFlags = [];
}

// Clean Passages in Chemistry
const aminesText = `Amines are considered to be derivatives of ammonia obtained by replacement of hydrogen atoms with alkyl or aryl groups.

They are usually prepared from nitro compounds, halides, amides, imides etc. The presence of hydrogen bonding influences its physical properties. In alkylamines, a combination of electron releasing steric and hydrogen bonding factors influences the stability of substituted ammonium cations in protic polar solvents and thus affects the basic nature of amines. Alkyl amines are found to be stronger bases than ammonia which is more basic than water. Primary and secondary amines are engaged in intermolecular association due to hydrogen bonding. This intermolecular association is more in primary amines than in secondary amines. Tertiary amines do not have intermolecular association due to the absence of hydrogen atom available for hydrogen bonding. Thus, the boiling point of amines depends on hydrogen bonding. In aromatic amines, electron releasing and withdrawing groups increase and decrease their basic character. Aryl diazonium salts usually obtained from arylamine undergo replacement of the diazonium group with a variety of nucleophile. Their coupling reaction of aryl diazonium salts with phenol or arylamine results in formation of dyes.`;

const electroText = `Electrochemistry is the study involving two types of processes. One type involves the production of electricity from the energy released during a spontaneous chemical reaction. Galvanic cells like Daniel cells are used to produce electricity from the redox reaction. Nernst equation of a galvanic cell gives the relation between the standard cell potential and the concentration of the species involved in the redox reaction. The second type of study involves the cells in which electrical energy is used to bring about the chemical reactions in a non-spontaneous process. The conductance of electrolytic solution depends on many factors including the nature of the electrolyte and the dimensions of the electrolytic cell.`;

// Replace passage contents
for (const pas of chemPassages) {
  if (pas.contentEn.includes("Amines are considered")) {
    pas.contentEn = aminesText;
  } else if (pas.contentEn.includes("Electrochemistry is the study")) {
    pas.contentEn = electroText;
  }
}

// Clean Q41..Q50
const chemUpdates = {
  41: {
    stem: "Complete the reaction by giving the final product:\n\nChloroethane + ethanolic (NaCN) + LiAlH_{4} \\rightarrow ?",
    options: [
      { id: "A", text: "CH_{3}CH_{2}NH_{2}" },
      { id: "B", text: "CH_{3}CH_{2}CH_{2}NH_{2}" },
      { id: "C", text: "CH_{3}CH_{2}CN" },
      { id: "D", text: "CH_{3}CH_{2}CH_{2}CN" }
    ],
    ans: "B"
  },
  42: {
    stem: "The most basic species in the following is:",
    options: [
      { id: "A", text: "$ \\mathrm{NH_{2}^{-}} $" },
      { id: "B", text: "$ \\mathrm{H_{2}O} $" },
      { id: "C", text: "$ \\mathrm{OH^{-}} $" },
      { id: "D", text: "$ \\mathrm{NH_{3}} $" }
    ],
    ans: "A"
  },
  43: {
    stem: "Carbylamine reaction is used as a test for:",
    options: [
      { id: "A", text: "Primary aliphatic amine" },
      { id: "B", text: "Primary aliphatic and aromatic amine" },
      { id: "C", text: "Secondary aliphatic amine" },
      { id: "D", text: "Secondary aromatic amine" }
    ],
    ans: "B"
  },
  45: {
    stem: "Which of the following compounds will not undergo azo coupling with benzene diazonium chloride?",
    options: [
      { id: "A", text: "Anisole" },
      { id: "B", text: "Phenol" },
      { id: "C", text: "Aniline" },
      { id: "D", text: "Nitrobenzene" }
    ],
    ans: "D"
  },
  46: {
    stem: "The conductivity of ionic electrolytic solutions does not depend on:",
    options: [
      { id: "A", text: "Concentration of electrolyte" },
      { id: "B", text: "Viscosity of solvent" },
      { id: "C", text: "Solvation of ion" },
      { id: "D", text: "Pressure" }
    ],
    ans: "D"
  },
  47: {
    stem: "What is the SI unit of conductivity?",
    options: [
      { id: "A", text: "$ \\mathrm{S~m^{-1}} $" },
      { id: "B", text: "$ \\Omega~\\mathrm{m} $" },
      { id: "C", text: "$ \\mathrm{S~m} $" },
      { id: "D", text: "$ \\Omega~\\mathrm{m^{-1}} $" }
    ],
    ans: "A"
  },
  48: {
    stem: "Faraday's laws of electrolysis are related to:",
    options: [
      { id: "A", text: "Speed of cation" },
      { id: "B", text: "Equivalent mass of electrolyte" },
      { id: "C", text: "Atomic number of anion" },
      { id: "D", text: "Atomic number of cation" }
    ],
    ans: "B"
  },
  49: {
    stem: "When KCl is dissolved in water, the Potassium ion is:",
    options: [
      { id: "A", text: "Oxidized" },
      { id: "B", text: "Reduced" },
      { id: "C", text: "Hydrated" },
      { id: "D", text: "Hydrolyzed" }
    ],
    ans: "C"
  },
  50: {
    stem: "The following equation represents the reaction taking place in a Galvanic cell:\n\n$$ \\mathrm{Mg(s)+2Ag^{+}(0.001M) \\rightarrow Mg^{2+}(0.01M)+2Ag(s)} $$\n\nCalculate its $ E_{\\text{cell}} $ at 298 K if $ E_{\\text{cell}}^{\\circ} = 2.91 \\, \\text{V} $.",
    options: [
      { id: "A", text: "2.79 V" },
      { id: "B", text: "2.96 V" },
      { id: "C", text: "3.21 V" },
      { id: "D", text: "1.52 V" }
    ],
    ans: "A"
  }
};

for (const [noStr, upd] of Object.entries(chemUpdates)) {
  const q = chemQs.find(x => (x.sourceQuestionNo || x.number) === parseInt(noStr));
  if (q) {
    q.stemEn = upd.stem;
    q.optionsEn = upd.options;
    q.correctAnswer = upd.ans;
    q.reviewStatus = "keyed";
    q.reviewFlags = [];
  }
}

writeFileSync(chemFile, JSON.stringify(chem, null, 2), "utf8");
console.log("[OK] Fully updated chemistry-2025-05-23-shift-2.json");

// 2. Update biology-2025-05-20-shift-1.json
const bioFile = join(PAPERS_DIR, "biology-2025-05-20-shift-1.json");
const bio = JSON.parse(readFileSync(bioFile, "utf8"));
const bioQs = bio.exam?.questions || bio.questions;

const bioTables = {
  11: {
    table: `<table border="1" style="margin: auto; width: 100%; border-collapse: collapse; text-align: left;">
  <thead>
    <tr style="background-color: rgba(255, 255, 255, 0.05);">
      <th style="padding: 8px; border: 1px solid #444;">Immunity barriers</th>
      <th style="padding: 8px; border: 1px solid #444;">Examples</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="padding: 8px; border: 1px solid #444;">(A) Physical barriers</td><td style="padding: 8px; border: 1px solid #444;">(I) Interferons</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #444;">(B) Cellular barriers</td><td style="padding: 8px; border: 1px solid #444;">(II) Acid in the stomach</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #444;">(C) Cytokine barriers</td><td style="padding: 8px; border: 1px solid #444;">(III) Skin</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #444;">(D) Physiological barriers</td><td style="padding: 8px; border: 1px solid #444;">(IV) WBCs</td></tr>
  </tbody>
</table>`,
    ans: "C"
  },
  17: {
    table: `<table border="1" style="margin: auto; width: 100%; border-collapse: collapse; text-align: left;">
  <thead>
    <tr style="background-color: rgba(255, 255, 255, 0.05);">
      <th style="padding: 8px; border: 1px solid #444;">Characteristics</th>
      <th style="padding: 8px; border: 1px solid #444;">Examples</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="padding: 8px; border: 1px solid #444;">(A) Symbiotic association with roots of leguminous plants</td><td style="padding: 8px; border: 1px solid #444;">(I) Glomus</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #444;">(B) Fixes atmospheric nitrogen while free living in the soil</td><td style="padding: 8px; border: 1px solid #444;">(II) Rhizobium</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #444;">(C) Symbiotic association of fungi and plants</td><td style="padding: 8px; border: 1px solid #444;">(III) Anabaena</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #444;">(D) Cyanobacteria which can fix atmospheric nitrogen</td><td style="padding: 8px; border: 1px solid #444;">(IV) Azotobacter</td></tr>
  </tbody>
</table>`,
    ans: "D"
  },
  28: {
    table: `<table border="1" style="margin: auto; width: 100%; border-collapse: collapse; text-align: left;">
  <thead>
    <tr style="background-color: rgba(255, 255, 255, 0.05);">
      <th style="padding: 8px; border: 1px solid #444;">List-I (Evolutionary stages of human species)</th>
      <th style="padding: 8px; border: 1px solid #444;">List-II (Time of origin)</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="padding: 8px; border: 1px solid #444;">(A) Ramapithecus</td><td style="padding: 8px; border: 1px solid #444;">(I) About 1.5 million years ago</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #444;">(B) Neanderthal man</td><td style="padding: 8px; border: 1px solid #444;">(II) About 2 million years ago</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #444;">(C) Australopithecines</td><td style="padding: 8px; border: 1px solid #444;">(III) 1,00,000-40,000 years ago</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #444;">(D) Homo erectus</td><td style="padding: 8px; border: 1px solid #444;">(IV) About 15 million years ago</td></tr>
  </tbody>
</table>`,
    ans: "B"
  },
  31: {
    table: `<table border="1" style="margin: auto; width: 100%; border-collapse: collapse; text-align: left;">
  <thead>
    <tr style="background-color: rgba(255, 255, 255, 0.05);">
      <th style="padding: 8px; border: 1px solid #444;">List-I (Geological periods)</th>
      <th style="padding: 8px; border: 1px solid #444;">List-II (Plants evolved)</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="padding: 8px; border: 1px solid #444;">(A) Devonian</td><td style="padding: 8px; border: 1px solid #444;">(I) Gnetales</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #444;">(B) Carboniferous</td><td style="padding: 8px; border: 1px solid #444;">(II) Cycads</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #444;">(C) Jurassic</td><td style="padding: 8px; border: 1px solid #444;">(III) Seed ferns</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #444;">(D) Cretaceous</td><td style="padding: 8px; border: 1px solid #444;">(IV) Progymnopserms</td></tr>
  </tbody>
</table>`,
    ans: "C"
  },
  39: {
    table: `<table border="1" style="margin: auto; width: 100%; border-collapse: collapse; text-align: left;">
  <thead>
    <tr style="background-color: rgba(255, 255, 255, 0.05);">
      <th style="padding: 8px; border: 1px solid #444;">List-I (Structures)</th>
      <th style="padding: 8px; border: 1px solid #444;">List-II (Characteristics)</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="padding: 8px; border: 1px solid #444;">(A) Heterochromatin</td><td style="padding: 8px; border: 1px solid #444;">(I) A set of positively charged basic proteins</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #444;">(B) Nucleosomes</td><td style="padding: 8px; border: 1px solid #444;">(II) Densely packed and inactive genetic material</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #444;">(C) Histones</td><td style="padding: 8px; border: 1px solid #444;">(III) Transcriptionally active genetic material</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #444;">(D) Euchromatin</td><td style="padding: 8px; border: 1px solid #444;">(IV) DNA is wrapped around the histone octamer to form this structure</td></tr>
  </tbody>
</table>`,
    ans: "A"
  }
};

for (const [noStr, upd] of Object.entries(bioTables)) {
  const q = bioQs.find(x => (x.sourceQuestionNo || x.number) === parseInt(noStr));
  if (q) {
    q.stemEn = `Match List-I with List-II:\n\n${upd.table}`;
    q.assets = [];
    q.correctAnswer = upd.ans;
    q.reviewStatus = "keyed";
    q.reviewFlags = [];
  }
}

writeFileSync(bioFile, JSON.stringify(bio, null, 2), "utf8");
console.log("[OK] Fully updated biology-2025-05-20-shift-1.json with all complete tables!");

