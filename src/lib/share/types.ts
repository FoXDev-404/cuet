import type { PublicQuestionOption } from "./public-question";

/**
 * The subset of a public question the share card needs. `PublicQuestionView`
 * is structurally compatible, and solution pages can build this from the
 * question revision they already loaded without re-querying the public page.
 */
export type ShareQuestion = {
  publicId: string;
  text: string;
  textHi: string | null;
  options: PublicQuestionOption[];
  optionsHi: PublicQuestionOption[] | null;
  imageUrl: string | null;
  imageAlt: string | null;
  subject: { name: string };
};

export type ShareAnswer = {
  correctOption: number;
  explanation: string | null;
  explanationHi: string | null;
  explanationImageUrl: string | null;
  explanationImageAlt: string | null;
};
