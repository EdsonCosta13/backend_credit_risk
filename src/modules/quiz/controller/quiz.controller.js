import { quizService } from "../service/quiz.service.js";
import { QuizAnswerRequestDTO } from "../dtos/quiz-answer.request.dto.js";
import { QuizStartResponseDTO } from "../dtos/quiz-start.response.dto.js";
import { QuizAnswerResponseDTO } from "../dtos/quiz-answer.response.dto.js";
import { jsonResponse } from "../../../shared/utils/response.util.js";

export const quizController = {
  start() {
    const question = quizService.getFirstQuestion();

    const responseDTO = new QuizStartResponseDTO({
      id: question.id,
      text: question.text,
      options: question.options
    });

    return jsonResponse(responseDTO);
  },

  async answer(request) {
    const body = await request.json();
    const requestDTO = new QuizAnswerRequestDTO(body);

    const nextQuestion = quizService.getNextQuestion(requestDTO);

    const responseDTO = new QuizAnswerResponseDTO({
      id: nextQuestion.id,
      text: nextQuestion.text,
      options: nextQuestion.options,
      riskLevel: nextQuestion.level
    });

    return jsonResponse(responseDTO);
  }
};
