export class QuizAnswerResponseDTO {
  constructor({ id, text, options, riskLevel }) {
    this.id = id;
    this.text = text;
    this.options = options;
    this.riskLevel = riskLevel;
  }
}
