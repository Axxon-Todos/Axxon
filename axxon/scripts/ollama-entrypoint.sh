#!/bin/sh
# Starts the Ollama server, waits for readiness, and pre-pulls the configured MVP model when needed.
set -eu

# Expose the server to sibling containers while keeping local CLI checks pointed at loopback.
SERVER_HOST="0.0.0.0:11434"
LOCAL_HOST="127.0.0.1:11434"
MODEL="${AI_LOCAL_MODEL:-qwen2.5-coder:14b}"

# Bind the server to all interfaces so the Next.js app container can reach it over the Compose network.
OLLAMA_HOST="$SERVER_HOST" ollama serve &
OLLAMA_PID="$!"

# Ensure container shutdown also stops the child Ollama server process cleanly.
cleanup() {
  kill "$OLLAMA_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

ATTEMPT=0
# Wait for the local CLI to succeed before checking model availability or serving requests.
until OLLAMA_HOST="$LOCAL_HOST" ollama list >/dev/null 2>&1; do
  ATTEMPT=$((ATTEMPT + 1))

  if [ "$ATTEMPT" -ge 60 ]; then
    echo "Ollama did not become ready in time" >&2
    exit 1
  fi

  sleep 1
done

# Pull the configured default model on first boot so the app can use the chat endpoint immediately.
if ! OLLAMA_HOST="$LOCAL_HOST" ollama show "$MODEL" >/dev/null 2>&1; then
  echo "Pulling Ollama model: $MODEL"
  OLLAMA_HOST="$LOCAL_HOST" ollama pull "$MODEL"
fi

# Keep the container attached to the Ollama server lifecycle.
wait "$OLLAMA_PID"
