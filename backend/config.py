"""
Objectiv backend config. Uses Ollama for chat (no OpenAI).
"""
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Ollama (local)
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")

# Server (OBJECTIV_* preferred; AZIAI_* kept as legacy aliases)
OBJECTIV_HOST = os.environ.get("OBJECTIV_HOST") or os.environ.get("AZIAI_HOST", "0.0.0.0")
OBJECTIV_PORT = int(os.environ.get("OBJECTIV_PORT") or os.environ.get("AZIAI_PORT", "8004"))
AZIAI_HOST = OBJECTIV_HOST  # legacy
AZIAI_PORT = OBJECTIV_PORT  # legacy
