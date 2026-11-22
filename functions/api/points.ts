interface Env {
  POINTS_KV?: KVNamespace;
  SECURITY_PIN?: string;
}

interface HistoryEntry {
  id: string;
  person: "vivi" | "andy";
  delta: number;
  newValue: number;
  timestamp: string;
}

const MAX_HISTORY_ENTRIES = 100;

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  // GET: Obtener puntos actuales e historial
  if (request.method === "GET") {
    let vivi = 0;
    let andy = 0;
    let history: HistoryEntry[] = [];

    if (env.POINTS_KV) {
      const [v, a, h] = await Promise.all([
        env.POINTS_KV.get("vivi"),
        env.POINTS_KV.get("andy"),
        env.POINTS_KV.get("history"),
      ]);
      if (v !== null) vivi = parseFloat(v);
      if (a !== null) andy = parseFloat(a);
      if (h !== null) {
        try {
          const parsed = JSON.parse(h);
          if (Array.isArray(parsed)) history = parsed;
        } catch (e) {}
      }
    }

    return new Response(JSON.stringify({ vivi, andy, history }), { headers });
  }

  // POST: Modificar puntos (delta relativo o valor exacto absoluto) y registrar historial
  if (request.method === "POST") {
    try {
      const body = (await request.json()) as {
        person: string;
        delta?: number;
        exactValue?: number;
        pin: string;
      };
      const validPin = env.SECURITY_PIN || "0000";

      if (body.pin !== validPin) {
        return new Response(
          JSON.stringify({ error: "Clave de seguridad incorrecta" }),
          { status: 403, headers }
        );
      }

      const person = body.person?.toLowerCase()?.trim();
      if (person !== "vivi" && person !== "andy") {
        return new Response(
          JSON.stringify({ error: "Persona inválida" }),
          { status: 400, headers }
        );
      }

      let current = 0;
      if (env.POINTS_KV) {
        const stored = await env.POINTS_KV.get(person);
        if (stored !== null) current = parseFloat(stored);
      }

      let updatedVal = 0;
      if (body.exactValue !== undefined) {
        updatedVal = Math.max(0, Math.round(Number(body.exactValue) * 10) / 10);
      } else {
        const delta = Number(body.delta || 0);
        updatedVal = Math.max(0, Math.round((current + delta) * 10) / 10);
      }

      const actualDelta = Math.round((updatedVal - current) * 10) / 10;

      if (env.POINTS_KV) {
        await env.POINTS_KV.put(person, updatedVal.toString());

        let history: HistoryEntry[] = [];
        const rawHistory = await env.POINTS_KV.get("history");
        if (rawHistory) {
          try {
            const parsed = JSON.parse(rawHistory);
            if (Array.isArray(parsed)) history = parsed;
          } catch (e) {}
        }

        if (actualDelta !== 0) {
          const entry: HistoryEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            person,
            delta: actualDelta,
            newValue: updatedVal,
            timestamp: new Date().toISOString(),
          };
          history = [entry, ...history].slice(0, MAX_HISTORY_ENTRIES);
          await env.POINTS_KV.put("history", JSON.stringify(history));
        }

        const [v, a] = await Promise.all([
          env.POINTS_KV.get("vivi"),
          env.POINTS_KV.get("andy"),
        ]);

        return new Response(
          JSON.stringify({
            vivi: parseFloat(v || "0"),
            andy: parseFloat(a || "0"),
            history,
          }),
          { headers }
        );
      }

      return new Response(
        JSON.stringify({ [person]: updatedVal }),
        { headers }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: err.message || "Error procesando solicitud" }),
        { status: 400, headers }
      );
    }
  }

  return new Response("Method Not Allowed", { status: 405, headers });
};
