"""WebSocket endpoint for live incident push to the dashboard."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections for live event broadcasting."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"  [WS] Client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"  [WS] Client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, data: dict[str, Any]) -> None:
        """Send a message to all connected clients."""
        message = json.dumps(data, default=str)
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

    @property
    def client_count(self) -> int:
        return len(self.active_connections)


# Global manager instance — set in main.py at startup
manager = ConnectionManager()


@router.websocket("/ws/live-events")
async def websocket_endpoint(websocket: WebSocket):
    """
    WS /ws/live-events
    WebSocket push for newly reported incidents.
    Clients connect here to receive real-time updates when:
    - A new prediction is made (via POST /predict)
    - A new event is reported
    """
    await manager.connect(websocket)
    try:
        # Send welcome message
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to ASTRAM live event stream",
            "active_clients": manager.client_count,
        })

        # Keep connection alive; listen for any client messages
        while True:
            data = await websocket.receive_text()
            # Echo back or handle client messages if needed
            try:
                parsed = json.loads(data)
                if parsed.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket)
