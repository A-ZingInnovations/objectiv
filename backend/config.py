"""
Objectiv backend config. Uses Ollama for chat (no OpenAI).
"""
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Ollama (local)
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")

# Server
OBJECTIV_HOST = os.environ.get("OBJECTIV_HOST", "0.0.0.0")
OBJECTIV_PORT = int(os.environ.get("OBJECTIV_PORT", "8004"))
