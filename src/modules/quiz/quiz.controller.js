import { quizService } from "./quiz.service.js";
import { QuizAnswerRequestDTO } from "./dtos/quiz-answer.request.dto.js";
import { QuizStartResponseDTO } from "./dtos/quiz-start.response.dto.js";
import { QuizAnswerResponseDTO } from "./dtos/quiz-answer.response.dto.js";
import { jsonResponse } from "../../shared/utils/response.util.js";

export const quizController = {
  async start() {
    try {
      const startPayload = quizService.startSession();

      const responseDTO = new QuizStartResponseDTO({
        sessionId: startPayload.sessionId
      });

      return jsonResponse(responseDTO);
    } catch (error) {
      console.error("[quiz] erro ao iniciar quiz:", error);
      return jsonResponse(
        { error: error.message ?? "Nao foi possivel iniciar o quiz." },
        400
      );
    }
  },

  async answer(request) {
    try {
      const body = await request.json();
      const requestDTO = new QuizAnswerRequestDTO(body);

      const serviceResponse = await quizService.processAnswer(requestDTO);

      const responseDTO = new QuizAnswerResponseDTO({
        nextQuestion: serviceResponse.nextQuestion
          ? serviceResponse.nextQuestion.toJSON()
          : null,
        updatedScore: serviceResponse.updatedScore,
        inferredRiskLevel: serviceResponse.inferredRiskLevel,
        remainingQuestions: serviceResponse.remainingQuestions,
        quizCompleted: serviceResponse.quizCompleted,
        evaluationSummary: serviceResponse.evaluationSummary
      });

      return jsonResponse(responseDTO);
    } catch (error) {
      console.error("[quiz] erro ao processar resposta:", error);
      return jsonResponse(
        { error: error.message ?? "Nao foi possivel processar a resposta do quiz." },
        400
      );
    }
  }
};
