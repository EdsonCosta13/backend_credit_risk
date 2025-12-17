import { healthController } from "./health.controller.js";

export const healthRoutes = [
  {
    method: "GET",
    path: "/health",
    handler: healthController.check
  }
];
