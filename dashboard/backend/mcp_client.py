"""
Raw httpx-based MCP SSE client.
Does NOT require the `mcp` package — works on Python 3.9+.

MCP SSE transport protocol:
  1. GET to SSE URL → server sends `event: endpoint` with the messages path
  2. POST JSON-RPC payloads to that messages URL
  3. Server sends `event: message` responses via the SSE stream
"""

import ast
import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_REQ_COUNTER = 0


def _next_id() -> str:
    global _REQ_COUNTER
    _REQ_COUNTER += 1
    return str(_REQ_COUNTER)


class MCPClient:
    def __init__(self):
        self._url: str = os.getenv(
            "MCP_URL", "https://api.platform.xaidos.com/mcp/database/sse"
        )
        self._auth: str = os.getenv(
            "MCP_AUTH",
            "Basic bWFuYWdlcjpwcmVwYXJlLWFtYmllbnQtc2FuZHJh",
        )
        self._messages_url: Optional[str] = None
        self._pending: Dict[str, "asyncio.Future[dict]"] = {}
        self._client: Optional[httpx.AsyncClient] = None
        self._sse_task: Optional["asyncio.Task[None]"] = None
        self._ready = asyncio.Event()

    # ── Connection lifecycle ───────────────────────────────────────────────

    async def connect(self) -> None:
        self._client = httpx.AsyncClient(
            headers={"Authorization": self._auth},
            timeout=httpx.Timeout(30.0, read=None, connect=15.0),
            follow_redirects=True,
        )
        self._sse_task = asyncio.create_task(self._sse_listener())

        try:
            await asyncio.wait_for(self._ready.wait(), timeout=20.0)
        except asyncio.TimeoutError:
            await self.disconnect()
            raise RuntimeError("MCP connection timed out — check MCP_URL and MCP_AUTH")

        await self._initialize()
        logger.info("MCP connected to %s", self._url)

    async def disconnect(self) -> None:
        if self._sse_task:
            self._sse_task.cancel()
            try:
                await self._sse_task
            except asyncio.CancelledError:
                pass
        if self._client:
            await self._client.aclose()
        logger.info("MCP disconnected")

    # ── SSE listener ──────────────────────────────────────────────────────

    async def _sse_listener(self) -> None:
        assert self._client is not None
        try:
            async with self._client.stream(
                "GET",
                self._url,
                headers={"Accept": "text/event-stream", "Cache-Control": "no-cache"},
            ) as resp:
                resp.raise_for_status()
                event_type: Optional[str] = None
                data_lines: List[str] = []

                async for raw_line in resp.aiter_lines():
                    line = raw_line.strip()
                    if line.startswith("event:"):
                        event_type = line[6:].strip()
                    elif line.startswith("data:"):
                        data_lines.append(line[5:].strip())
                    elif line == "":
                        data = "\n".join(data_lines)
                        data_lines = []

                        if event_type == "endpoint" and data:
                            parsed = urlparse(self._url)
                            base = f"{parsed.scheme}://{parsed.netloc}"
                            self._messages_url = (
                                base + data if data.startswith("/") else data
                            )
                            self._ready.set()

                        elif event_type == "message" and data:
                            try:
                                msg = json.loads(data)
                                req_id = str(msg.get("id", ""))
                                fut = self._pending.get(req_id)
                                if fut and not fut.done():
                                    fut.set_result(msg)
                            except json.JSONDecodeError:
                                pass

                        event_type = None
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("SSE listener crashed: %s — scheduling reconnect", exc)
            self._ready.clear()
            self._messages_url = None
            # Fail all pending futures immediately
            for fut in list(self._pending.values()):
                if not fut.done():
                    fut.set_exception(exc)
            self._pending.clear()
            # Reconnect after a short delay
            await asyncio.sleep(2)
            asyncio.create_task(self._reconnect())
            return
        # Stream ended cleanly (server closed connection) — reconnect
        logger.warning("SSE stream ended unexpectedly — scheduling reconnect")
        self._ready.clear()
        self._messages_url = None
        for fut in list(self._pending.values()):
            if not fut.done():
                fut.set_exception(RuntimeError("SSE stream closed"))
        self._pending.clear()
        await asyncio.sleep(2)
        asyncio.create_task(self._reconnect())

    async def _reconnect(self) -> None:
        logger.info("MCP reconnecting...")
        try:
            if self._client:
                await self._client.aclose()
            self._client = httpx.AsyncClient(
                headers={"Authorization": self._auth},
                timeout=httpx.Timeout(30.0, read=None, connect=15.0),
                follow_redirects=True,
            )
            self._sse_task = asyncio.create_task(self._sse_listener())
            await asyncio.wait_for(self._ready.wait(), timeout=20.0)
            await self._initialize()
            self._ready.set()
            logger.info("MCP reconnected successfully")
        except Exception as exc:
            logger.error("MCP reconnect failed: %s — retrying in 5s", exc)
            await asyncio.sleep(5)
            asyncio.create_task(self._reconnect())

    # ── MCP JSON-RPC ──────────────────────────────────────────────────────

    async def _post(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        # If SSE task died without triggering reconnect, restart it now
        if self._sse_task and self._sse_task.done() and self._ready.is_set():
            logger.warning("SSE task died silently — forcing reconnect")
            self._ready.clear()
            self._messages_url = None
            asyncio.create_task(self._reconnect())
            await asyncio.wait_for(self._ready.wait(), timeout=30.0)

        if not self._messages_url or not self._client:
            raise RuntimeError("MCP not connected")

        req_id = _next_id()
        payload["id"] = req_id

        loop = asyncio.get_event_loop()
        future: "asyncio.Future[dict]" = loop.create_future()
        self._pending[req_id] = future

        try:
            resp = await self._client.post(
                self._messages_url,
                json=payload,
                headers={"Content-Type": "application/json"},
            )

            # Streamable HTTP transport: result is in the POST response body
            if resp.status_code == 200 and resp.content:
                try:
                    data = resp.json()
                    if isinstance(data, dict) and ("result" in data or "error" in data):
                        return data
                except Exception:
                    pass

            # Classic SSE transport: wait for SSE message event
            return await asyncio.wait_for(asyncio.shield(future), timeout=45.0)
        finally:
            self._pending.pop(req_id, None)

    async def _initialize(self) -> None:
        await self._post(
            {
                "jsonrpc": "2.0",
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "xaid-dashboard", "version": "1.0"},
                },
            }
        )
        # MCP spec: notification method is "notifications/initialized"
        assert self._client and self._messages_url
        await self._client.post(
            self._messages_url,
            json={"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}},
            headers={"Content-Type": "application/json"},
        )
        # Give the server a moment to finish session setup before tool calls
        await asyncio.sleep(2)

    # ── Public API ────────────────────────────────────────────────────────

    async def execute_sql(self, query: str) -> List[Dict[str, Any]]:
        result = await self._post(
            {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {"name": "execute_sql", "arguments": {"sql": query}},
            }
        )

        if "error" in result:
            raise RuntimeError(f"MCP error: {result['error']}")

        content = result.get("result", {}).get("content", [])
        for item in content:
            if item.get("type") == "text":
                text = item["text"]
                # Server may return JSON or Python repr (single-quoted dicts)
                for parser in (json.loads, ast.literal_eval):
                    try:
                        data = parser(text)
                        if isinstance(data, list):
                            return data
                        if isinstance(data, dict):
                            if "rows" in data:
                                return data["rows"]
                            if "error" in data:
                                raise RuntimeError(f"SQL error: {data['error']}")
                            return [data]
                        break
                    except (json.JSONDecodeError, ValueError, SyntaxError):
                        continue
                else:
                    # Plain text error from server
                    if text.startswith("Error:"):
                        raise RuntimeError(f"MCP tool error: {text}")
                    logger.warning("Unparseable MCP response: %.200s", text)
        return []

    async def fetch_one(self, query: str) -> Optional[Dict[str, Any]]:
        rows = await self.execute_sql(query)
        return rows[0] if rows else None
