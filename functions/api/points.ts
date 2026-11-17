interface Env {
  POINTS_KV?: KVNamespace;
  SECURITY_PIN?: string;
}

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

  // GET: Obtener puntos actuales
  if (request.method === "GET") {
    let vivi = 0;
    let andy = 0;

    if (env.POINTS_KV) {
      const v = await env.POINTS_KV.get("vivi");
      const a = await env.POINTS_KV.get("andy");
      if (v !== null) vivi = parseFloat(v);
      if (a !== null) andy = parseFloat(a);
    }

    return new Response(JSON.stringify({ vivi, andy }), { headers });
  }

  // POST: Modificar puntos (delta relativo o valor exacto absoluto)
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

      let updatedVal = 0;

      if (body.exactValue !== undefined) {
        // Asignación de valor exacto directo
        updatedVal = Math.max(0, Math.round(Number(body.exactValue) * 10) / 10);
      } else {
        // Incremento o decremento
        let current = 0;
        if (env.POINTS_KV) {
          const stored = await env.POINTS_KV.get(person);
          if (stored !== null) current = parseFloat(stored);
        }
        const delta = Number(body.delta || 0);
        updatedVal = Math.max(0, Math.round((current + delta) * 10) / 10);
      }

      if (env.POINTS_KV) {
        await env.POINTS_KV.put(person, updatedVal.toString());
        const v = (await env.POINTS_KV.get("vivi")) || "0";
        const a = (await env.POINTS_KV.get("andy")) || "0";
        return new Response(
          JSON.stringify({ vivi: parseFloat(v), andy: parseFloat(a) }),
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
