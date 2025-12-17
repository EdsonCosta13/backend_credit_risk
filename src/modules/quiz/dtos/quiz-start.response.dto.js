export class QuizStartResponseDTO {
  constructor({
    question,
    initialScore = 0,
    inferredRiskLevel = "medio"
  }) {
    this.question = question;
    this.initialScore = initialScore;
    this.inferredRiskLevel = inferredRiskLevel;
  }
}
