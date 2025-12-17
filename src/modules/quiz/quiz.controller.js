import { quizService } from "./quiz.service.js";
import { QuizAnswerRequestDTO } from "./dtos/quiz-answer.request.dto.js";
import { QuizStartResponseDTO } from "./dtos/quiz-start.response.dto.js";
import { QuizAnswerResponseDTO } from "./dtos/quiz-answer.response.dto.js";
import { jsonResponse } from "../../shared/utils/response.util.js";

export const quizController = {
  async start() {
    const question = await quizService.createInitialQuestion();

    const responseDTO = new QuizStartResponseDTO({
      question: question.toJSON(),
      initialScore: 0,
      inferredRiskLevel: question.riskLevel
    });

    return jsonResponse(responseDTO);
  },

  async answer(request) {
    const body = await request.json();
    const requestDTO = new QuizAnswerRequestDTO(body);

    const serviceResponse = await quizService.processAnswer(requestDTO);

    const responseDTO = new QuizAnswerResponseDTO({
      nextQuestion: serviceResponse.nextQuestion.toJSON(),
      updatedScore: serviceResponse.updatedScore,
      inferredRiskLevel: serviceResponse.inferredRiskLevel
    });

    return jsonResponse(responseDTO);
  }
};
