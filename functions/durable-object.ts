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

  async getPoints(): Promise<{ vivi: number; andy: number }> {
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
    // Permite incrementos con decimales (como 0.5) y redondea a 1 decimal para evitar errores de precisión flotante
    const updated = Math.max(0, Math.round((current + delta) * 10) / 10);
    await this.state.storage.put(p, updated);

    const points = await this.getPoints();
    this.broadcast({ type: "SYNC", data: points });
    return points;
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
          const targetPin = "0000";
          if (data.pin !== targetPin) {
            ws.send(JSON.stringify({ type: "ERROR", message: "Clave de seguridad incorrecta" }));
            return;
          }

          await this.updatePoints(data.person, Number(data.delta));
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
