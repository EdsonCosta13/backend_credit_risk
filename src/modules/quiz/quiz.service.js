import { QuizQuestion } from "./quiz.entity.js";

const LLAMA_URL = "http://localhost:11434/api/generate";
const LLAMA_MODEL = "llama3:8b";
const QUESTION_TTL_MS = 10 * 60 * 1000;

const questionRegistry = new Map();

export const quizService = {
  async createInitialQuestion() {
    const question = await generateQuestion({
      isInitial: true,
      currentScore: 0,
      lastAnswer: "",
      lastRiskLevel: "medio",
      historySummary: "Sem respostas anteriores."
    });

    rememberQuestion(question);
    return question;
  },

  async processAnswer(answerDTO) {
    const previousQuestion = findQuestion(answerDTO.questionId);
    const historySummary = buildHistorySummary(answerDTO.history);

    const nextQuestion = await generateQuestion({
      isInitial: false,
      currentScore: answerDTO.currentScore,
      lastAnswer: answerDTO.answer,
      lastRiskLevel: previousQuestion?.riskLevel ?? "medio",
      historySummary
    });

    rememberQuestion(nextQuestion);

    const updatedScore = calculateScore({
      currentScore: answerDTO.currentScore,
      answer: answerDTO.answer,
      previousQuestion
    });

    const inferredRiskLevel = inferRiskLevel(updatedScore);

    return {
      nextQuestion,
      updatedScore,
      inferredRiskLevel
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

const BASE_PROMPT = `
Voce e um consultor financeiro especializado em avaliar o risco de credito de clientes.
Gere apenas UMA pergunta por vez, focada em entendimento de objectivos financeiros, capacidade de pagamento e tolerancia ao risco.
Responda unicamente com JSON valido no formato:
{
  "question": "texto claro e objectivo",
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
Contexto: cliente iniciando avaliacao de risco de credito.
Score acumulado: 0.
Historico: sem respostas anteriores.
Objetivo: formular a primeira pergunta que combine finalidade do credito e tolerancia ao risco.
`;
  }

  return `${BASE_PROMPT}
Contexto actualizado:
- Score actual: ${currentScore}
- Ultimo nivel de risco analisado: ${lastRiskLevel}
- Ultima resposta fornecida: ${lastAnswer || "nao informado"}
- Historico resumido:
${historySummary}

Formule a proxima pergunta mantendo o foco em risco de credito e adaptando o nivel de dificuldade conforme o perfil identificado.`;
}
