export class QuizAnswerResponseDTO {
  constructor({
    nextQuestion,
    updatedScore,
    inferredRiskLevel,
    remainingQuestions = 0,
    quizCompleted = false
  }) {
    this.nextQuestion = nextQuestion;
    this.updatedScore = updatedScore;
    this.inferredRiskLevel = inferredRiskLevel;
    this.remainingQuestions = remainingQuestions;
    this.quizCompleted = quizCompleted;
  }
}
