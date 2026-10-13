# Objectiv backend

AI API for the Objectiv app (optional demo chat). Uses **Ollama** for chat (no OpenAI).

**Prerequisites:** [Ollama](https://ollama.com) installed and running, with a model pulled (e.g. `ollama pull llama3.2`).

```bash
# Terminal 1: run Ollama
ollama serve
ollama pull llama3.2

# Terminal 2: run backend
pip install -r requirements.txt
cp .env.example .env   # optional: change OLLAMA_MODEL
python main.py         # http://0.0.0.0:8004
```

Set `VITE_OBJECTIV_API_URL=http://localhost:8004` in the app `.env` to point Objectiv at this backend (legacy: `VITE_AZIAI_API_URL`).

**Env:** `OLLAMA_BASE_URL` (default `http://localhost:11434`), `OLLAMA_MODEL` (default `llama3.2`).
