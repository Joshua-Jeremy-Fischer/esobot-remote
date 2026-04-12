import httpx
from langchain_core.tools import tool
from config import ESO_BOT_BASE_URL, ESO_BOT_TOKEN


def _headers() -> dict:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {ESO_BOT_TOKEN}",
    }


async def _post(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            f"{ESO_BOT_BASE_URL}{path}",
            json=body,
            headers=_headers(),
        )
        r.raise_for_status()
        return r.json()


@tool
async def web_fetch(url: str) -> str:
    """Fetch the full text content of a URL."""
    data = await _post("/tools/web_fetch", {"url": url})
    return data.get("content", "")


@tool
async def read_file(path: str) -> str:
    """Read a file from the sandbox workspace."""
    data = await _post("/tools/read_file", {"path": path})
    return data.get("content", "")


@tool
async def write_file(path: str, content: str) -> str:
    """Write content to a file in the sandbox workspace."""
    data = await _post("/tools/write_file", {"path": path, "content": content})
    return "ok" if data.get("ok") else str(data)


@tool
async def list_files(path: str = ".") -> str:
    """List files at the given workspace path."""
    data = await _post("/tools/list_files", {"path": path})
    return str(data.get("files", []))


@tool
async def bash(command: str) -> str:
    """Execute a bash command in the sandbox workspace."""
    data = await _post("/tools/bash", {"command": command})
    return data.get("stdout", "") + data.get("stderr", "")


RESEARCHER_TOOLS = [web_fetch]
CODER_TOOLS      = [read_file, write_file, list_files, bash]
QA_TOOLS         = [read_file, list_files]
FIXER_TOOLS      = [read_file, write_file, list_files, bash]
