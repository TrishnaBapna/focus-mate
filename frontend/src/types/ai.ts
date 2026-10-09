export interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number; // 0-based position of the correct option
  explanation: string;
}

export interface Flashcard {
  front: string;
  back: string;
}
