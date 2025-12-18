export class QuizAnswerRequestDTO {
  constructor({
    sessionId,
    questionId,
    answer,
    currentScore = 0,
    history = []
  } = {}) {
    this.sessionId = typeof sessionId === "string" ? sessionId.trim() : "";
    this.questionId = questionId;
    this.answer = typeof answer === "string" ? answer.trim() : "";
    this.currentScore = Number.isFinite(currentScore) ? currentScore : 0;
    this.history = Array.isArray(history) || typeof history === "string"
      ? history
      : [];
  }
}
