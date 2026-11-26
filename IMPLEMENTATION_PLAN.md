# Objective Agent Execution Dashboard — Implementation Plan

## Goal
Build a native Agent Execution Dashboard inside the Objectiv VS Code alternative (`/Users/azing/all-repos/objectiv`) giving real-time visibility into AI-assisted software development: projects, sessions, agents, tasks/subtasks, dependencies, events, file modifications, verification results, blockers/errors.

## Constraints & approach
- Do NOT introduce a second application architecture. Integrate into the existing Vite+React+Electron+FastAPI app as a workbench panel.
- Do not overwrite existing working functionality (working tree already has unrelated modifications — leave them alone).
- Follow existing design system: `objectivThemes.ts` (dark-plus), `activityPanels.ts` (activity bar), codicon icons, `settingsContext`/`localStorage` state, `desktopWorkspace` native IPC for disk persistence.
- Small verified milestones; run `npx vitest run` after each; update `IMPLEMENTATION_STATUS.md` and `IMPLEMENTATION_LOG.md`.
- Accuracy rules are mandatory: planned ≠ in progress ≠ completed ≠ verified; verification requires evidence; progress derived from real state; full history preserved.

## Tracking engine (app/src/agentExecution/)
- `types.ts` — standardized event protocol + domain types (Project, Session, Agent, Task, Subtask, FileChange, VerificationResult, Blocker)
- `eventStore.ts` — centralized in-memory store + persistence to localStorage (web) and disk JSON via `desktopWorkspace.writeWorkspaceFile` (Electron), survives restarts
- `trackingEngine.ts` — create project/session/agent/task/subtask, set dependencies, emit events, derive state (status rollups, verified %, active agents), query API
- Event IDs unique; every event carries id, projectId, sessionId, agentId (where applicable), timestamp, payload

## Event protocol (standardized events)
PROJECT_CREATED, PLAN_CREATED, PLAN_UPDATED, TASK_CREATED, TASK_ASSIGNED, TASK_STARTED, TASK_PROGRESS, TASK_COMPLETED, TASK_FAILED, TASK_BLOCKED, FILE_CREATED, FILE_MODIFIED, FILE_DELETED, TEST_STARTED, TEST_PASSED, TEST_FAILED, BUILD_STARTED, BUILD_PASSED, BUILD_FAILED, AGENT_STARTED, AGENT_IDLE, AGENT_COMPLETED (+ internal SESSION_CREATED, AGENT_ERROR)

## Dashboard modules (app/src/components/agentExecution/)
A. Project Overview — totals, planned/in-progress/completed/failed/blocked, active agents, verified completion %
B. Task Management — Kanban board, task hierarchy, dependencies, priority, assigned agent, status, verification status, history
C. Agent Monitor — identity, current assignment, activity, duration, files being modified, last activity, errors, dependencies
D. File Monitor — created/modified/deleted, agent, task, git diff viewer, file history
E. Execution Timeline — chronological event stream, agent activity, task transitions, tool executions, test results, failures/recovery
F. Testing & Verification — build results, unit/integration test results, lint, failed test details, verification history

## Integration
- Add `agent-execution` activity bar item (`activityPanels.ts`) + panel title
- Wire panel into `WorkbenchShell` side-bar content (like `LiveStatsPanel`)
- Claude Code adapter (`app/src/agentExecution/adapters/claudeCode.ts`) reading Claude Code hook event output; translate to common protocol; never infer unobserved status
- Provider-independent adapter interface (`adapter.ts`): Claude Code, OpenAI Codex, Cursor (where supported), Custom

## Persistence
- localStorage key `objectiv-agent-execution-v1` (works in web + Electron renderer)
- Optional disk JSON under workspace `.objectiv/agent-execution.json` via `desktopWorkspace` when a workspace root is open

## Milestones
| # | Milestone | Deliverable |
|---|-----------|-------------|
| 1 | Tracking engine core | types + event store + tracking engine + unit tests |
| 2 | Dashboard shell | activity bar item + empty panel wiring + persistence smoke test |
| 3 | Project Overview | stats tiles + verified % |
| 4 | Task Management | kanban + hierarchy + dependencies + history |
| 5 | Agent Monitor | agent panels + activity + errors |
| 6 | File Monitor | file change list + diff viewer + history |
| 7 | Execution Timeline | chronological event stream + filtering |
| 8 | Testing & Verification | build/test/lint results + failed test details |
| 9 | Claude Code adapter | hook-based event ingestion |
| 10 | Additional adapters + E2E | Codex/Cursor/custom adapters + one end-to-end monitored execution + final test run |

## Acceptance criteria
- Dashboard displays real execution events
- Tasks tracked planning → verification
- Agent activity visible
- File changes associated with tasks/agents when evidence available
- History persists after restart
- Claude Code integration tested
- ≥1 end-to-end execution monitored
- All relevant tests pass
