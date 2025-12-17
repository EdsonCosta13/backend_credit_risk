import { QuizModule } from "../modules/quiz/quiz.module.js";
import { healthRoutes } from "../modules/health/health.routes.js";

const routes = [
  ...healthRoutes,
  ...QuizModule.routes
];

export async function router(request) {
  const url = new URL(request.url);
  const method = request.method;

  for (const route of routes) {
    if (route.method === method && route.path === url.pathname) {
      return route.handler(request);
    }
  }

  return new Response(
    JSON.stringify({ error: "Rota não encontrada" }),
    { status: 404, headers: { "Content-Type": "application/json" } }
  );
}
