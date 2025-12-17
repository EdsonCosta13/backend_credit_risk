export class QuizAnswerRequestDTO {
  constructor({ questionId, answer, score }) {
    this.questionId = questionId;
    this.answer = answer;
    this.score = score;
  }
}
