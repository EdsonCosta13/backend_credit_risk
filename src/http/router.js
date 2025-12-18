import { QuizModule } from "../modules/quiz/quiz.module.js";
import { healthRoutes } from "../modules/health/health.routes.js";

const routes = [
  ...healthRoutes,
  ...QuizModule.routes
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function router(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: buildCorsHeaders() });
  }

  const url = new URL(request.url);
  const method = request.method;

  for (const route of routes) {
    if (route.method === method && route.path === url.pathname) {
      const response = await route.handler(request);
      return applyCors(response);
    }
  }

  return applyCors(
    new Response(
      JSON.stringify({ error: "Rota nao encontrada" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    )
  );
}

function buildCorsHeaders(extra = {}) {
  const headers = new Headers(CORS_HEADERS);

  for (const [key, value] of Object.entries(extra)) {
    headers.set(key, value);
  }

  return headers;
}

function applyCors(response) {
  if (!(response instanceof Response)) {
    return new Response(
      JSON.stringify({ error: "Resposta invalida do servidor" }),
      { status: 500, headers: buildCorsHeaders({ "Content-Type": "application/json" }) }
    );
  }

  const headers = buildCorsHeaders(Object.fromEntries(response.headers.entries()));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
