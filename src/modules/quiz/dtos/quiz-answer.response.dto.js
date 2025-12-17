export class QuizAnswerResponseDTO {
  constructor({ nextQuestion, updatedScore, inferredRiskLevel }) {
    this.nextQuestion = nextQuestion;
    this.updatedScore = updatedScore;
    this.inferredRiskLevel = inferredRiskLevel;
  }
}
