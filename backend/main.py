"""
Objectiv backend — AI API for the Objectiv app.
Chat + agent that creates/edits files from user task descriptions. Uses Ollama.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Any

from config import OLLAMA_BASE_URL, OLLAMA_MODEL

# Parse agent response for file actions: <<<CREATE path>>>\ncontent\n<<<END>>> or <<<EDIT path>>>
ACTION_PATTERN = re.compile(
    r"<<<(CREATE|EDIT)\s+([^\s>]+)>>>\s*\n(.*?)<<<END>>>",
    re.DOTALL,
)

app = FastAPI(
    title="Objectiv Backend",
    description="AI API for the Objectiv app. Chat via Ollama (local LLM).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("OBJECTIV_CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str = Field(..., description="user | assistant | system")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_id: Optional[str] = None
    max_tokens: int = 512


class ChatResponse(BaseModel):
    message: ChatMessage
    usage: Optional[dict] = None


class WorkspaceContext(BaseModel):
    file_tree: list[str] = Field(default_factory=list, description="List of file paths")
    file_contents: dict[str, str] = Field(default_factory=dict, description="path -> content")
    open_files: list[str] = Field(default_factory=list, description="Currently open paths")


class AgentRequest(BaseModel):
    messages: list[ChatMessage]
    workspace: Optional[WorkspaceContext] = None


class FileAction(BaseModel):
    type: str = Field(..., description="create_file | edit_file")
    path: str
    content: str


class AgentResponse(BaseModel):
    message: ChatMessage
    actions: list[FileAction] = Field(default_factory=list)
    usage: Optional[dict] = None


def _parse_agent_actions(text: str) -> tuple[str, list[dict[str, Any]]]:
    """Extract <<<CREATE path>>> / <<<EDIT path>>> blocks; return (cleaned_text, actions)."""
    actions = []
    cleaned = text

    for m in ACTION_PATTERN.finditer(text):
        op, path, content = m.group(1).strip().upper(), m.group(2).strip(), m.group(3)
        path = path.strip()
        content = content.rstrip()
        if op == "CREATE":
            actions.append({"type": "create_file", "path": path, "content": content})
        else:
            actions.append({"type": "edit_file", "path": path, "content": content})
        cleaned = cleaned.replace(m.group(0), f"[{op} {path}]", 1)

    return cleaned.strip(), actions


def _build_agent_system_prompt(workspace: Optional[WorkspaceContext]) -> str:
    prompt = """You are a coding agent inside an IDE. The user describes tasks and you implement them by creating or editing files.

RULES:
1. Reply briefly to the user, then output the file changes.
2. To CREATE a new file use exactly:
<<<CREATE path/to/file.ext>>>
full file content here
<<<END>>>

3. To REPLACE the entire content of an existing file use exactly:
<<<EDIT path/to/file.ext>>>
full new file content here
<<<END>>>

4. Use correct paths (e.g. src/Component.tsx). One block per file. Output only valid file content (no markdown code fences inside the block).
5. If the task is unclear or you cannot do it, reply in plain text and do not output any CREATE/EDIT blocks."""
    if workspace and workspace.file_tree:
        prompt += "\n\nCurrent workspace files:\n" + "\n".join(f"  - {p}" for p in sorted(workspace.file_tree))
    if workspace and workspace.file_contents:
        prompt += "\n\nRelevant file contents (for context):\n"
        for path, content in list(workspace.file_contents.items())[:10]:
            snippet = (content or "")[:800].replace("<<<", "[angle brackets]")
            prompt += f"\n--- {path} ---\n{snippet}\n"
    return prompt


@app.get("/health")
def health():
    return {"status": "ok", "service": "objectiv-backend", "version": "0.1.0", "ollama": OLLAMA_BASE_URL}


@app.post("/v1/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages required")

    try:
        return _chat_ollama(req)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ollama error: {str(e)}")


def _chat_ollama(req: ChatRequest) -> ChatResponse:
    import httpx

    url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/chat"
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [{"role": m.role, "content": m.content} for m in req.messages],
        "stream": False,
    }

    with httpx.Client(timeout=120.0) as client:
        r = client.post(url, json=payload)
        r.raise_for_status()
        data = r.json()

    msg = data.get("message", {})
    content = msg.get("content", "")
    eval_count = data.get("eval_count")
    prompt_eval_count = data.get("prompt_eval_count")
    usage = None
    if eval_count is not None or prompt_eval_count is not None:
        usage = {"prompt_tokens": prompt_eval_count or 0, "completion_tokens": eval_count or 0}

    return ChatResponse(
        message=ChatMessage(role="assistant", content=content),
        usage=usage,
    )


@app.post("/v1/agent", response_model=AgentResponse)
def agent(req: AgentRequest):
    """Agent: user describes a task, model returns message + file actions (create/edit)."""
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages required")
    try:
        return _agent_ollama(req)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ollama error: {str(e)}")


def _agent_ollama(req: AgentRequest) -> AgentResponse:
    import httpx

    system_content = _build_agent_system_prompt(req.workspace)
    messages = [{"role": "system", "content": system_content}]
    for m in req.messages:
        messages.append({"role": m.role, "content": m.content})

    url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/chat"
    payload = {"model": OLLAMA_MODEL, "messages": messages, "stream": False}

    with httpx.Client(timeout=180.0) as client:
        r = client.post(url, json=payload)
        r.raise_for_status()
        data = r.json()

    msg = data.get("message", {})
    raw_content = msg.get("content", "")
    cleaned_content, action_dicts = _parse_agent_actions(raw_content)
    actions = [FileAction(**a) for a in action_dicts]

    usage = None
    if data.get("eval_count") is not None or data.get("prompt_eval_count") is not None:
        usage = {
            "prompt_tokens": data.get("prompt_eval_count") or 0,
            "completion_tokens": data.get("eval_count") or 0,
        }

    return AgentResponse(
        message=ChatMessage(role="assistant", content=cleaned_content),
        actions=actions,
        usage=usage,
    )


if __name__ == "__main__":
    import uvicorn
    from config import OBJECTIV_HOST, OBJECTIV_PORT
    uvicorn.run(app, host=OBJECTIV_HOST, port=OBJECTIV_PORT)
