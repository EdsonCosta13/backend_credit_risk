import { jsonResponse } from "../../shared/utils/response.util.js";

export const healthController = {
  check() {
    return jsonResponse({
      status: "UP",
      message: "API operacional"
    });
  }
};
