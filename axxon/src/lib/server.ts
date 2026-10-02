// Starts the websocket server process independently from the durable agent worker process.
import http from "http";
import { loadRuntimeEnv } from "./env/loadRuntimeEnv";
import { createWsServer } from "./wsServer";

loadRuntimeEnv();

const PORT = process.env.WS_PORT || 4000;

// Create a plain Node HTTP server
const server = http.createServer();

// Attach Socket.IO + Redis pub/sub to it
createWsServer(server);

// Start listening
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on http://localhost:${PORT}`);
});
