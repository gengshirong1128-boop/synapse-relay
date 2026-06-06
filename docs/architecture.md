# Architecture Overview

## Runtime Components

- FastAPI backend (`backend/main.py`)
- Frontend workspace (`frontend/index.html`, `frontend/app.js`)
- Optional desktop shell (`desktop/`)

## Core Modules

- ChatRoom / AgentInstance orchestration
- Round-based panel and debate workflows
- Provider/Profile/Credential routing
- Project reader and context builder
- Executor exporters and runner

## Execution Flow

1. User submits task in room.
2. Coordinator assigns specialist tasks by round.
3. Shared Brief syncs context between rounds.
4. Final plan is exported or executed via runner.
