# Agent Backend Module

`src/lib/agents` owns every backend agent concern. Next.js route handlers only authenticate, resolve organization and board scope, validate input, and call application services.

## Lifecycle

`queued → preparing → awaiting_input | awaiting_plan_review → dispatching → dispatched → executing → awaiting_result_review → completed`

`failed` and `cancelled` are available from active states; a failed run may be retried into `queued`. The state machine in `domain/stateMachine.ts` is the only place that defines legal transitions.

## Capabilities

All board members may view and create runs. The initiating member and organization owners may supply input, request changes, approve, retry, or cancel when `domain/capabilities.ts` exposes the action for the current state.

## Persistence and Worker

`agent_runs` is the current snapshot and `agent_run_events` is the append-only audit log. `agent_jobs` is the durable worker queue; the standalone `pnpm agent:worker` process claims jobs with row locks. `agent_outbox_events` records approved dispatch requests and becomes published before a run reaches `dispatched`.

## Provider and Safety

The first adapter is local Ollama. It receives read-only board-run input and may only return clarification questions or a reviewable plan artifact. This module does not mutate GitHub repositories or execute generated code.
