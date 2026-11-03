-- Migration 0020: Exam Info Verified Facts & Verification Gates
-- Seeds official verified exam facts with source URLs and last_verified dates,
-- and flags unverified facts as TODO_VERIFY to trigger client verification notices.

INSERT INTO exam_info (key, value, source_url, last_verified)
VALUES
  (
    'exam-pattern',
    'CUET (UG) is conducted by National Testing Agency (NTA) in hybrid mode / Computer Based Test (CBT). The paper consists of Multiple Choice Questions (MCQs) divided into: Section 1A and 1B (Languages, 40 out of 50 questions to be attempted), Section 2 (Domain-specific subjects, 40/50 questions), and Section 3 (General Test, 50 out of 60 questions).',
    'https://exams.nta.ac.in/CUET-UG/',
    '2026-11-04'
  ),
  (
    'marking-scheme',
    'As per the official NTA CUET (UG) Information Bulletin:
• Correct answer: Five marks (+5)
• Incorrect answer: Minus one mark (-1)
• Unanswered / Marked for Review: Zero marks (0)
• If more than one option is found to be correct, +5 marks will be awarded to only those who marked any of the correct options.
• If all options are found to be correct, +5 marks will be awarded to all who attempted the question.',
    'https://exams.nta.ac.in/CUET-UG/',
    '2026-11-04'
  ),
  (
    'syllabus',
    'CUET (UG) domain subject syllabus is based strictly on NCERT Class 12 curriculum. Languages test reading comprehension, literary aptitude, and vocabulary. The General Test covers general knowledge, current affairs, general mental ability, numerical ability, quantitative reasoning, and logical and analytical reasoning.',
    'https://exams.nta.ac.in/CUET-UG/',
    '2026-11-04'
  ),
  (
    'important-dates',
    'TODO_VERIFY',
    'https://exams.nta.ac.in/CUET-UG/',
    NULL
  ),
  (
    'eligibility',
    'For appearing in the CUET (UG), there is no age limit for the candidates. The candidates who have passed the class 12 / equivalent examination or are appearing in 2026 irrespective of their age can appear in CUET (UG). However, candidates must fulfill the university-specific age and qualification criteria of the respective admitting institutions.',
    'https://exams.nta.ac.in/CUET-UG/',
    '2026-11-04'
  ),
  (
    'subject-combination',
    'Candidates may choose up to a maximum of 6 test papers (comprising Section 1 Languages, Section 2 Domain Subjects, and Section 3 General Test) based on the admission requirements of their target universities and programmes.',
    'https://exams.nta.ac.in/CUET-UG/',
    '2026-11-04'
  )
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  source_url = excluded.source_url,
  last_verified = excluded.last_verified;
