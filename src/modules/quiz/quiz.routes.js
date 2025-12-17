import { quizController } from "../controller/quiz.controller.js";

export const quizRoutes = [
  {
    method: "GET",
    path: "/quiz/start",
    handler: quizController.start
  },
  {
    method: "POST",
    path: "/quiz/answer",
    handler: quizController.answer
  }
];
