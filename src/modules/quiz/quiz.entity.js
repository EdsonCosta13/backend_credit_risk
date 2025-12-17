export class QuizQuestion {
  constructor({
    id,
    text,
    options = [],
    riskLevel = "medio"
  }) {
    this.id = id;
    this.text = text;
    this.options = options;
    this.riskLevel = riskLevel;
  }

  toJSON() {
    return {
      id: this.id,
      text: this.text,
      options: this.options,
      riskLevel: this.riskLevel
    };
  }
}
