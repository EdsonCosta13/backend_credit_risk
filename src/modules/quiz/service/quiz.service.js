import { QuizQuestion } from "../model/quiz.entity.js";

const QUESTIONS = [
  new QuizQuestion({
    id: 1,
    text: "Qual o objectivo do crédito?",
    options: ["Consumo", "Investimento", "Emergência"],
    level: "base"
  }),
  new QuizQuestion({
    id: 2,
    text: "Aceitaria perder parte do capital?",
    options: ["Sim", "Não"],
    level: "alto"
  }),
  new QuizQuestion({
    id: 3,
    text: "Prefere estabilidade?",
    options: ["Sim", "Não"],
    level: "baixo"
  })
];

export const quizService = {
  getFirstQuestion() {
    return QUESTIONS[0];
  },

  getNextQuestion(answerDTO) {
    if (answerDTO.score > 70) {
      return QUESTIONS.find(q => q.level === "alto");
    }
    return QUESTIONS.find(q => q.level === "baixo");
  }
};
