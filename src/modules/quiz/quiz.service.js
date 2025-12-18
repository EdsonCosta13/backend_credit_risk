import { QuizQuestion } from "./quiz.entity.js";

const LLAMA_URL = "http://localhost:11434/api/generate";
const LLAMA_MODEL = "llama3:8b";
const QUESTION_TTL_MS = 10 * 60 * 1000;
const MAX_QUESTIONS_PER_SESSION = 20;
const SESSION_TTL_MS = 30 * 60 * 1000;

const questionRegistry = new Map();
const sessionRegistry = new Map();

export const quizService = {
  startSession() {
    const session = createSession();
    return {
      sessionId: session.id
    };
  },

  async processAnswer(answerDTO) {
    const session = getSessionOrThrow(answerDTO.sessionId);
    const isFirstQuestionRequest = session.questionsAsked === 0 && !answerDTO.questionId;

    if (isFirstQuestionRequest) {
      const question = await generateQuestion({
        isInitial: true,
        currentScore: 0,
        lastAnswer: "",
        lastRiskLevel: "medio",
        historySummary: "Sem respostas anteriores."
      });

      rememberQuestion(question);
      const updatedSession = registerQuestionForSession(session, question.id);

      return {
        nextQuestion: question,
        updatedScore: 0,
        inferredRiskLevel: question.riskLevel,
        remainingQuestions: calculateRemainingQuestions(updatedSession),
        quizCompleted: false
      };
    }

    if (!answerDTO.questionId) {
      throw new Error("O identificador da pergunta e obrigatorio.");
    }

    const previousQuestion = findQuestion(answerDTO.questionId);
    if (!previousQuestion) {
      throw new Error("Pergunta fornecida invalida ou expirada.");
    }

    const historySummary = buildHistorySummary(answerDTO.history);

    const updatedScore = calculateScore({
      currentScore: answerDTO.currentScore,
      answer: answerDTO.answer,
      previousQuestion
    });

    const inferredRiskLevel = inferRiskLevel(updatedScore);

    if (session.questionsAsked >= session.maxQuestions) {
      session.completed = true;
      sessionRegistry.set(session.id, session);
      return {
        nextQuestion: null,
        updatedScore,
        inferredRiskLevel,
        remainingQuestions: 0,
        quizCompleted: true
      };
    }

    const nextQuestion = await generateQuestion({
      isInitial: false,
      currentScore: answerDTO.currentScore,
      lastAnswer: answerDTO.answer,
      lastRiskLevel: previousQuestion?.riskLevel ?? "medio",
      historySummary
    });

    rememberQuestion(nextQuestion);
    const updatedSession = registerQuestionForSession(session, nextQuestion.id);

    return {
      nextQuestion,
      updatedScore,
      inferredRiskLevel,
      remainingQuestions: calculateRemainingQuestions(updatedSession),
      quizCompleted: false
    };
  }
};

async function generateQuestion({
  isInitial,
  currentScore,
  lastAnswer,
  lastRiskLevel,
  historySummary
}) {
  const prompt = buildPrompt({
    isInitial,
    currentScore,
    lastAnswer,
    lastRiskLevel,
    historySummary
  });

  try {
    const modelResponse = await requestQuestionFromModel(prompt);
    return parseModelQuestion(modelResponse, lastRiskLevel);
  } catch (error) {
    console.error("[quiz] Falha ao contactar LLaMA:", error);
    return fallbackQuestion(lastRiskLevel);
  }
}

async function requestQuestionFromModel(prompt) {
  const response = await fetch(LLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLAMA_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.4 }
    })
  });

  if (!response.ok) {
    throw new Error(`LLaMA retornou ${response.status}`);
  }

  const payload = await response.json();
  return (payload.response ?? payload?.choices?.[0]?.text ?? "").trim();
}

function parseModelQuestion(modelText, fallbackRisk) {
  const jsonSnippet = extractJson(modelText);

  if (!jsonSnippet) {
    return fallbackQuestion(fallbackRisk);
  }

  try {
    const parsed = JSON.parse(jsonSnippet);
    const questionText = typeof parsed.question === "string"
      ? parsed.question.trim()
      : "";

    if (!questionText) {
      return fallbackQuestion(fallbackRisk);
    }

    const options = sanitizeOptions(parsed.options);
    const riskLevel = normalizeRiskLevel(parsed.riskLevel, fallbackRisk);

    return new QuizQuestion({
      id: crypto.randomUUID(),
      text: questionText,
      options,
      riskLevel
    });
  } catch {
    return fallbackQuestion(fallbackRisk);
  }
}

function fallbackQuestion(riskLevel = "medio") {
  return new QuizQuestion({
    id: crypto.randomUUID(),
    text: "Qual e o principal objectivo do credito que pretende solicitar?",
    options: [
      "Financiar consumo imediato",
      "Investir em um negocio",
      "Criar reserva para emergencias"
    ],
    riskLevel
  });
}

function sanitizeOptions(candidate) {
  if (Array.isArray(candidate)) {
    return candidate
      .map(option => typeof option === "string" ? option.trim() : "")
      .filter(Boolean)
      .slice(0, 4);
  }

  if (typeof candidate === "string") {
    return candidate
      .split(/[,;|]/)
      .map(option => option.trim())
      .filter(Boolean)
      .slice(0, 4);
  }

  return [
    "Prefiro estabilidade",
    "Aceito alguma volatilidade",
    "Busco retornos agressivos"
  ];
}

function extractJson(text) {
  if (!text) {
    return null;
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1) {
    return null;
  }

  return text.slice(start, end + 1);
}

function normalizeRiskLevel(level, fallback = "medio") {
  const value = (level ?? "").toString().toLowerCase();

  if (value.includes("alto") || value.includes("high")) {
    return "alto";
  }

  if (value.includes("baixo") || value.includes("low")) {
    return "baixo";
  }

  if (value.includes("medio") || value.includes("moderado") || value.includes("medium")) {
    return "medio";
  }

  return fallback;
}

function calculateScore({ currentScore, answer, previousQuestion }) {
  const baseScore = Number.isFinite(currentScore) ? currentScore : 0;
  const normalizedAnswer = (answer ?? "").toString().toLowerCase();
  const referenceRisk = previousQuestion?.riskLevel ?? "medio";

  let delta = 5;

  if (referenceRisk === "alto") {
    delta = normalizedAnswer.includes("sim") || normalizedAnswer.includes("aceito") ? 15 : -12;
  } else if (referenceRisk === "medio") {
    if (normalizedAnswer.includes("depende") || normalizedAnswer.includes("equilibrado")) {
      delta = 8;
    } else {
      delta = 6;
    }
  } else {
    delta = normalizedAnswer.includes("seguro") || normalizedAnswer.includes("baixo") ? 10 : -5;
  }

  return clampScore(baseScore + delta);
}

function clampScore(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return Math.round(value);
}

function inferRiskLevel(score) {
  if (score >= 70) {
    return "alto";
  }

  if (score >= 40) {
    return "medio";
  }

  return "baixo";
}

function buildHistorySummary(history = []) {
  if (typeof history === "string" && history.trim().length > 0) {
    return history.trim();
  }

  if (!Array.isArray(history) || history.length === 0) {
    return "Sem respostas anteriores.";
  }

  return history
    .map((entry, index) => {
      const q = entry.question ?? entry.questionText ?? entry.id ?? `Pergunta ${index + 1}`;
      const answer = entry.answer ?? entry.response ?? "Nao informado";
      const risk = entry.riskLevel ?? entry.inferredRiskLevel ?? "desconhecido";
      const partialScore = entry.score ?? entry.partialScore ?? "n/d";

      return `${index + 1}. ${q} | Resposta: ${answer} | Score: ${partialScore} | Risco: ${risk}`;
    })
    .join("\n");
}

function rememberQuestion(question) {
  if (!question?.id) {
    return;
  }

  cleanupRegistry();
  questionRegistry.set(question.id, { question, createdAt: Date.now() });
}

function findQuestion(questionId) {
  if (!questionId || !questionRegistry.has(questionId)) {
    return null;
  }

  const entry = questionRegistry.get(questionId);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.createdAt > QUESTION_TTL_MS) {
    questionRegistry.delete(questionId);
    return null;
  }

  return entry.question;
}

function cleanupRegistry() {
  const now = Date.now();

  for (const [id, entry] of questionRegistry.entries()) {
    if (now - entry.createdAt > QUESTION_TTL_MS) {
      questionRegistry.delete(id);
    }
  }
}

function createSession() {
  cleanupSessions();

  const session = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    maxQuestions: MAX_QUESTIONS_PER_SESSION,
    questionsAsked: 0,
    completed: false
  };

  sessionRegistry.set(session.id, session);
  return session;
}

function getSessionOrThrow(sessionId) {
  cleanupSessions();

  const session = findSession(sessionId);

  if (!session) {
    throw new Error("Sessao de quiz invalida ou expirada.");
  }

  if (session.completed) {
    throw new Error("Este quiz ja foi finalizado.");
  }

  return session;
}

function registerQuestionForSession(session, questionId) {
  if (!session) {
    throw new Error("Sessao de quiz invalida ou expirada.");
  }

  if (session.questionsAsked >= session.maxQuestions) {
    throw new Error("Limite de perguntas atingido para esta sessao.");
  }

  session.questionsAsked += 1;
  session.lastQuestionId = questionId;
  session.updatedAt = Date.now();
  sessionRegistry.set(session.id, session);
  return session;
}

function calculateRemainingQuestions(session) {
  if (!session) {
    return 0;
  }

  return Math.max(session.maxQuestions - session.questionsAsked, 0);
}

function findSession(sessionId) {
  if (!sessionId || !sessionRegistry.has(sessionId)) {
    return null;
  }

  const session = sessionRegistry.get(sessionId);
  if (!session) {
    return null;
  }

  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessionRegistry.delete(sessionId);
    return null;
  }

  return session;
}

function cleanupSessions() {
  const now = Date.now();

  for (const [id, session] of sessionRegistry.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessionRegistry.delete(id);
    }
  }
}

const BASE_PROMPT = `
Voce e um analista financeiro especializado em avaliacao de confianca para concessao de credito.
O seu objectivo e avaliar se um cliente demonstra condicoes suficientes para obter credito de forma responsavel.

A avaliacao deve considerar:
- Capacidade e estabilidade de pagamento
- Comportamento financeiro e disciplina
- Clareza na finalidade do credito
- Planeamento e tolerancia ao risco

REGRAS OBRIGATORIAS:
- Gere APENAS UMA pergunta por vez
- A pergunta DEVE ser adaptada com base na resposta anterior e no historico fornecido
- A pergunta deve aprofundar o entendimento do perfil do cliente
- Use exclusivamente portugues de Portugal
- Linguagem clara, formal e adequada ao sector financeiro
- Nao utilize termos em ingles
- Nao forneca explicacoes fora do JSON

Responda SEMPRE com JSON valido exactamente no seguinte formato:
{
  "question": "texto claro, objectivo e profissional",
  "options": ["opcao A", "opcao B", "opcao C"],
  "riskLevel": "baixo|medio|alto"
}
`;


function buildPrompt({
  isInitial,
  currentScore,
  lastAnswer,
  lastRiskLevel,
  historySummary
}) {
  if (isInitial) {
    return `${BASE_PROMPT}
  Contexto:
  O cliente esta a iniciar um processo de avaliacao de confianca para concessao de credito.
  Ainda nao existem respostas anteriores.
  Score actual: 0.
  
  Objectivo da pergunta:
  Compreender a finalidade do credito e o grau inicial de planeamento financeiro do cliente.
  `;
  }
  

  return `${BASE_PROMPT}
  Contexto actualizado da avaliacao de credito:
  
  - Score actual do cliente: ${currentScore}
  - Nivel de risco previamente identificado: ${lastRiskLevel}
  - Ultima resposta fornecida pelo cliente: "${lastAnswer || "nao informado"}"
  
  Resumo do historico de respostas:
  ${historySummary}
  
  Instrucao:
  Com base DIRECTA na ultima resposta e no historico acima,
  formule a PROXIMA pergunta de forma adaptativa.
  
  A pergunta deve:
  - Explorar um novo aspecto relevante para confianca de concessao de credito
  - Ajustar a profundidade conforme o perfil identificado
  - Ajudar a confirmar ou refinar o nivel de risco actual
  
  Nao repita perguntas anteriores.
  `;
  
}
