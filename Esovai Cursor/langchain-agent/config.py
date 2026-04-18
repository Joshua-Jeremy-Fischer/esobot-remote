import os
from langchain_openai import ChatOpenAI

ESO_BOT_BASE_URL    = os.environ.get("ESO_BOT_BASE_URL", "http://eso-bot:3020").rstrip("/")
ESO_BOT_TOKEN       = os.environ.get("ESO_BOT_TOKEN", "")

NVIDIA_API_KEY      = os.environ.get("NVIDIA_API_KEY", "")
NVIDIA_BASE_URL     = "https://integrate.api.nvidia.com/v1"
NVIDIA_MODEL        = os.environ.get("NVIDIA_MODEL", "moonshotai/kimi-k2-instruct-0905")

OLLAMA_BASE_URL     = os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434/v1")
OLLAMA_MODEL        = os.environ.get("OLLAMA_MODEL", "kimi-k2.5:cloud")
OLLAMA_TIMEOUT      = int(os.environ.get("OLLAMA_TIMEOUT", "120"))

MAX_FIX_ITERATIONS  = int(os.environ.get("MAX_FIX_ITERATIONS", "3"))
PORT                = int(os.environ.get("PORT", "8001"))


def make_llm(temperature: float = 0.2) -> ChatOpenAI:
    """Ollama (Kimi K2.5) as default, NVIDIA as automatic fallback if key is set."""
    ollama = ChatOpenAI(
        api_key="ollama",
        base_url=OLLAMA_BASE_URL,
        model=OLLAMA_MODEL,
        temperature=temperature,
        timeout=OLLAMA_TIMEOUT,
    )
    if not NVIDIA_API_KEY:
        return ollama

    nvidia = ChatOpenAI(
        api_key=NVIDIA_API_KEY,
        base_url=NVIDIA_BASE_URL,
        model=NVIDIA_MODEL,
        temperature=temperature,
    )
    return ollama.with_fallbacks([nvidia])
