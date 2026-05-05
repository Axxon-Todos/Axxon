// Starts the websocket server process and the long-lived planning run worker used for async planning execution.
import http from "http";
import { startPlanningRunWorker } from "./ai/planningRunWorker";
import { loadRuntimeEnv } from "./env/loadRuntimeEnv";
import { createWsServer } from "./wsServer";

loadRuntimeEnv();

const PORT = process.env.WS_PORT || 4000;

// Create a plain Node HTTP server
const server = http.createServer();

// Attach Socket.IO + Redis pub/sub to it
createWsServer(server);
startPlanningRunWorker();

// Start listening
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on http://localhost:${PORT}`);
});
