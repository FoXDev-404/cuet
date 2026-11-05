import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const chemFile = join("public/local-papers/papers", "chemistry-2025-05-23-shift-2.json");
const chem = JSON.parse(readFileSync(chemFile, "utf8"));
const chemQs = chem.exam?.questions || chem.questions;

// Q03: clean dumped explanation from Option D
const q03 = chemQs.find(q => (q.sourceQuestionNo || q.number) === 3);
if (q03) {
  q03.optionsEn = [
    { id: "A", text: "1:1 electrolyte" },
    { id: "B", text: "1:2 electrolyte" },
    { id: "C", text: "2:1 electrolyte" },
    { id: "D", text: "1:3 electrolyte" }
  ];
  q03.correctAnswer = "D";
  q03.reviewStatus = "keyed";
  q03.reviewFlags = [];
}

// Q11: clean sequence question
const q11 = chemQs.find(q => (q.sourceQuestionNo || q.number) === 11);
if (q11) {
  q11.correctAnswer = "A";
  q11.reviewStatus = "keyed";
  q11.reviewFlags = [];
}

// Q12: clean Match List table
const q12 = chemQs.find(q => (q.sourceQuestionNo || q.number) === 12);
if (q12) {
  q12.stemEn = `Match List-I with List-II:

<table border="1" style="margin: auto; width: 100%; border-collapse: collapse; text-align: left;">
  <thead>
    <tr style="background-color: rgba(255, 255, 255, 0.05);">
      <th style="padding: 8px; border: 1px solid #444;">List-I</th>
      <th style="padding: 8px; border: 1px solid #444;">List-II</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 8px; border: 1px solid #444;">(A) Wurtz-Fittig reaction</td>
      <td style="padding: 8px; border: 1px solid #444;">(I) $\\mathrm{CH_3COCl}$ and Anhyd. $\\mathrm{AlCl_3}$</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #444;">(B) Chiral</td>
      <td style="padding: 8px; border: 1px solid #444;">(II) CFCs</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #444;">(C) Friedel-Crafts Acylation</td>
      <td style="padding: 8px; border: 1px solid #444;">(III) Alkylarene</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #444;">(D) Freons</td>
      <td style="padding: 8px; border: 1px solid #444;">(IV) Non-superimposable mirror images</td>
    </tr>
  </tbody>
</table>`;
  q12.optionsEn = [
    { id: "A", text: "(A) - (III), (B) - (IV), (C) - (I), (D) - (II)" },
    { id: "B", text: "(A) - (I), (B) - (III), (C) - (II), (D) - (IV)" },
    { id: "C", text: "(A) - (I), (B) - (II), (C) - (IV), (D) - (III)" },
    { id: "D", text: "(A) - (III), (B) - (IV), (C) - (II), (D) - (I)" }
  ];
  q12.assets = [];
  q12.correctAnswer = "A";
  q12.reviewStatus = "keyed";
  q12.reviewFlags = [];
}

// Q22: clean properties of metals table
const q22 = chemQs.find(q => (q.sourceQuestionNo || q.number) === 22);
if (q22) {
  q22.stemEn = `Match the properties given in List-I with the metals given in List-II:

<table border="1" style="margin: auto; width: 100%; border-collapse: collapse; text-align: left;">
  <thead>
    <tr style="background-color: rgba(255, 255, 255, 0.05);">
      <th style="padding: 8px; border: 1px solid #444;">List-I (Property)</th>
      <th style="padding: 8px; border: 1px solid #444;">List-II (Metal)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 8px; border: 1px solid #444;">(A) Element with highest second ionization enthalpy</td>
      <td style="padding: 8px; border: 1px solid #444;">(I) Co</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #444;">(B) Element with highest heat of atomisation</td>
      <td style="padding: 8px; border: 1px solid #444;">(II) Cu</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #444;">(C) M in $\\mathrm{M(CO)_6}$</td>
      <td style="padding: 8px; border: 1px solid #444;">(III) Zn</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #444;">(D) Element with highest third ionization enthalpy</td>
      <td style="padding: 8px; border: 1px solid #444;">(IV) Cr</td>
    </tr>
  </tbody>
</table>`;
  q22.optionsEn = [
    { id: "A", text: "(A) - (II), (B) - (III), (C) - (I), (D) - (IV)" },
    { id: "B", text: "(A) - (II), (B) - (I), (C) - (IV), (D) - (III)" },
    { id: "C", text: "(A) - (III), (B) - (I), (C) - (IV), (D) - (II)" },
    { id: "D", text: "(A) - (III), (B) - (IV), (C) - (I), (D) - (II)" }
  ];
  q22.assets = [];
  q22.correctAnswer = "B";
  q22.reviewStatus = "keyed";
  q22.reviewFlags = [];
}

// Q29: clean Kolbe/Reimer-Tiemann Match List table
const q29 = chemQs.find(q => (q.sourceQuestionNo || q.number) === 29);
if (q29) {
  q29.stemEn = `Match List-I with List-II:

<table border="1" style="margin: auto; width: 100%; border-collapse: collapse; text-align: left;">
  <thead>
    <tr style="background-color: rgba(255, 255, 255, 0.05);">
      <th style="padding: 8px; border: 1px solid #444;">List-I (Reaction)</th>
      <th style="padding: 8px; border: 1px solid #444;">List-II (Preparation)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 8px; border: 1px solid #444;">(A) Kolbe's Reaction</td>
      <td style="padding: 8px; border: 1px solid #444;">(I) Salicylaldehyde</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #444;">(B) Reimer-Tiemann Reaction</td>
      <td style="padding: 8px; border: 1px solid #444;">(II) Salicylic acid</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #444;">(C) Williamson synthesis</td>
      <td style="padding: 8px; border: 1px solid #444;">(III) Ethyl methyl ether</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #444;">(D) Cumene Process</td>
      <td style="padding: 8px; border: 1px solid #444;">(IV) Phenol</td>
    </tr>
  </tbody>
</table>`;
  q29.optionsEn = [
    { id: "A", text: "(A) - (I), (B) - (II), (C) - (III), (D) - (IV)" },
    { id: "B", text: "(A) - (II), (B) - (I), (C) - (III), (D) - (IV)" },
    { id: "C", text: "(A) - (I), (B) - (II), (C) - (IV), (D) - (III)" },
    { id: "D", text: "(A) - (III), (B) - (IV), (C) - (I), (D) - (II)" }
  ];
  q29.assets = [];
  q29.correctAnswer = "B";
  q29.reviewStatus = "keyed";
  q29.reviewFlags = [];
}

writeFileSync(chemFile, JSON.stringify(chem, null, 2), "utf8");
console.log("[OK] Updated chemistry-2025-05-23-shift-2.json (q03, q11, q12, q22, q29)");

// Update keys.json
const keysFile = "src/data/local-papers/keys.json";
const keys = JSON.parse(readFileSync(keysFile, "utf8"));
const chemKeys = keys.papers["chemistry-2025-05-23-shift-2"] = keys.papers["chemistry-2025-05-23-shift-2"] || {};

chemKeys["q03"] = {
  a: "D",
  e: "1 mole of CrCl3·6H2O reacts with excess AgNO3 to produce 3 moles of AgCl, implying that all three Cl- ions are acting as counter ions outside the coordination sphere: [Cr(H2O)6]Cl3 -> [Cr(H2O)6]3+ + 3Cl-. Ratio of cations to anions is 1:3 electrolyte."
};
chemKeys["q11"] = {
  a: "A",
  e: "Sequence: (C) Select base and sugar -> (B) Attach base to 1' position of sugar -> (D) Attach phosphoric acid to 5' position of sugar -> (A) Formation of phosphodiester linkage between nucleotides."
};
chemKeys["q12"] = {
  a: "A",
  e: "(A) Wurtz-Fittig reaction -> Alkylarene (III); (B) Chiral -> Non-superimposable mirror images (IV); (C) Friedel-Crafts Acylation -> CH3COCl and Anhyd. AlCl3 (I); (D) Freons -> CFCs (II). Mapping: (A)-(III), (B)-(IV), (C)-(I), (D)-(II)."
};
chemKeys["q22"] = {
  a: "B",
  e: "(A) Highest second ionization enthalpy -> Cu (II); (B) Highest heat of atomisation -> Co (I); (C) M in M(CO)6 -> Cr (IV); (D) Highest third ionization enthalpy -> Zn (III). Mapping: (A)-(II), (B)-(I), (C)-(IV), (D)-(III)."
};
chemKeys["q29"] = {
  a: "B",
  e: "(A) Kolbe's Reaction -> Salicylic acid (II); (B) Reimer-Tiemann Reaction -> Salicylaldehyde (I); (C) Williamson synthesis -> Ethyl methyl ether (III); (D) Cumene Process -> Phenol (IV). Mapping: (A)-(II), (B)-(I), (C)-(III), (D)-(IV)."
};

writeFileSync(keysFile, JSON.stringify(keys, null, 2), "utf8");
console.log("[OK] Updated keys.json for Chemistry 2025-05-23 Shift 2");

