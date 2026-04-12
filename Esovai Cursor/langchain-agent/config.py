import os

ESO_BOT_BASE_URL    = os.environ.get("ESO_BOT_BASE_URL", "http://eso-bot:3020").rstrip("/")
ESO_BOT_TOKEN       = os.environ.get("ESO_BOT_TOKEN", "")

NVIDIA_API_KEY      = os.environ.get("NVIDIA_API_KEY", "")
NVIDIA_BASE_URL     = "https://integrate.api.nvidia.com/v1"
NVIDIA_MODEL        = os.environ.get("NVIDIA_MODEL", "moonshotai/kimi-k2-instruct-0905")

OLLAMA_BASE_URL     = os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434/v1")
OLLAMA_MODEL        = os.environ.get("OLLAMA_MODEL", "kimi-k2.5:cloud")

USE_NVIDIA          = bool(NVIDIA_API_KEY)
MAX_FIX_ITERATIONS  = int(os.environ.get("MAX_FIX_ITERATIONS", "3"))
PORT                = int(os.environ.get("PORT", "8001"))
