import { serve } from "https://deno.land/std/http/server.ts";
import { router } from "./router.js";
import { AppConfig } from "../config/app.config.js";

export function startServer() {
  console.log(`${AppConfig.APP_NAME} iniciado na porta ${AppConfig.PORT}`);
  serve(router, { port: AppConfig.PORT });
}
