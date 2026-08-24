# Agent Backend Module

`src/lib/agents` owns every backend agent concern. Next.js route handlers only authenticate, resolve organization and board scope, validate input, and call application services.

## Lifecycle

`queued → preparing → planning → awaiting_input → queued` repeats until planning is complete, then `planning → awaiting_plan_review → dispatching → dispatched → executing → awaiting_result_review → completed`.

`failed` and `cancelled` are available from active states; a failed run may be retried into `queued`. The state machine in `domain/stateMachine.ts` is the only place that defines legal transitions and the tool names each state may call.

## Capabilities

All board members may view and create runs. The initiating member and organization owners may supply input, request changes, approve, retry, or cancel when `domain/capabilities.ts` exposes the action for the current state.

## Persistence and Worker

`agent_runs` is the current snapshot, including run type, current clarification cards, planning context, readiness, and the generated plan artifact. `agent_run_events` is the append-only state audit log, and `agent_tool_calls` records durable tool-call history. `agent_jobs` is the durable worker queue; the standalone `pnpm agent:worker` process claims jobs with row locks. `agent_outbox_events` records approved dispatch requests and becomes published before a run reaches `dispatched`.

## Tool Calls

`src/lib/agents/toolCalls` owns all executable agent tools and the runtime registry. The registry resolves full tool descriptors from the current state node and rejects tool execution when the state machine does not allow the requested tool.

## Realtime UI

Agent run changes publish `board:agent:run:updated` through the existing board Socket.IO room. The org-level planning workspace at `/dashboard/orgs/[organizationId]/ai` selects a board, creates planning runs, displays clarification questions, reviews plans, and drives actions from backend capabilities.

## Provider and Safety

The first adapter is local Ollama. It receives read-only board-run input and returns schema-validated planning analysis or a reviewable plan artifact. Planning completion requires both the model's `complete_planning` decision with `requirements_satisfied` and deterministic readiness checks. This module does not mutate GitHub repositories or execute generated code.
