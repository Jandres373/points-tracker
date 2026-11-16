// Cloudflare Durable Object for Realtime Points Management via WebSockets & REST

export interface Env {
  POINTS_TRACKER_DO: DurableObjectNamespace;
  SECURITY_PIN?: string;
}

export class PointsTrackerDO {
  state: DurableObjectState;
  sessions: Set<WebSocket>;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
    this.sessions = new Set();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade for realtime updates
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      await this.handleWebSocket(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // REST Fallback / Direct HTTP API
    const pointsData = await this.getPoints();

    if (request.method === "GET") {
      return Response.json(pointsData);
    }

    if (request.method === "POST") {
      try {
        const body = await request.json() as { person: string; delta: number };
        const updated = await this.updatePoints(body.person, body.delta);
        return Response.json(updated);
      } catch (err: any) {
        return Response.json({ error: err.message || "Invalid payload" }, { status: 400 });
      }
    }

    return new Response("Not found", { status: 404 });
  }

  async getPoints(): Promise<{ vivi: number; andy: number; history?: any[] }> {
    const vivi = (await this.state.storage.get<number>("vivi")) ?? 0;
    const andy = (await this.state.storage.get<number>("andy")) ?? 0;
    return { vivi, andy };
  }

  async updatePoints(person: string, delta: number) {
    const p = person.toLowerCase().trim();
    if (p !== "vivi" && p !== "andy") {
      throw new Error("Persona inválida");
    }

    const current = (await this.state.storage.get<number>(p)) ?? 0;
    const newPoints = Math.max(0, current + delta); // Evita números negativos o permite según necesidad
    await this.state.storage.put(p, newPoints);

    const updated = await this.getPoints();
    this.broadcast({ type: "SYNC", data: updated });
    return updated;
  }

  async handleWebSocket(ws: WebSocket) {
    ws.accept();
    this.sessions.add(ws);

    // Enviar estado inicial nada más conectar
    const currentPoints = await this.getPoints();
    ws.send(JSON.stringify({ type: "SYNC", data: currentPoints }));

    ws.addEventListener("message", async (msg) => {
      try {
        const data = JSON.parse(msg.data as string);

        if (data.type === "PING") {
          ws.send(JSON.stringify({ type: "PONG" }));
          return;
        }

        if (data.type === "UPDATE_POINTS") {
          // data: { person: 'vivi' | 'andy', delta: number, pin: string }
          const targetPin = "0000";
          if (data.pin !== targetPin) {
            ws.send(JSON.stringify({ type: "ERROR", message: "Clave de seguridad incorrecta" }));
            return;
          }

          const updated = await this.updatePoints(data.person, data.delta);
          // broadcast ya es llamado dentro de updatePoints
        }
      } catch (e: any) {
        ws.send(JSON.stringify({ type: "ERROR", message: e.message || "Error procesando solicitud" }));
      }
    });

    ws.addEventListener("close", () => {
      this.sessions.delete(ws);
    });

    ws.addEventListener("error", () => {
      this.sessions.delete(ws);
    });
  }

  broadcast(message: object) {
    const payload = JSON.stringify(message);
    for (const session of this.sessions) {
      try {
        session.send(payload);
      } catch (e) {
        this.sessions.delete(session);
      }
    }
  }
}
