import { PointsTrackerDO } from "./durable-object";

export { PointsTrackerDO };

interface Env {
  POINTS_TRACKER_DO?: DurableObjectNamespace;
  POINTS_KV?: KVNamespace;
  SECURITY_PIN?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // Si Durable Object está disponible y configurado
  if (env.POINTS_TRACKER_DO) {
    const id = env.POINTS_TRACKER_DO.idFromName("global_points_room");
    const obj = env.POINTS_TRACKER_DO.get(id);
    return obj.fetch(request);
  }

  // Fallback con Cloudflare KV si Durable Object no estuviera vinculado directamente
  if (request.method === "GET") {
    let vivi = 0;
    let andy = 0;
    if (env.POINTS_KV) {
      vivi = parseInt((await env.POINTS_KV.get("vivi")) || "0", 10);
      andy = parseInt((await env.POINTS_KV.get("andy")) || "0", 10);
    }
    return Response.json({ vivi, andy });
  }

  if (request.method === "POST") {
    try {
      const body = await request.json() as { person: string; delta: number; pin: string };
      const validPin = env.SECURITY_PIN || "0000";

      if (body.pin !== validPin) {
        return Response.json({ error: "Clave de seguridad incorrecta" }, { status: 403 });
      }

      const person = body.person?.toLowerCase();
      if (person !== "vivi" && person !== "andy") {
        return Response.json({ error: "Persona inválida" }, { status: 400 });
      }

      let current = 0;
      if (env.POINTS_KV) {
        current = parseInt((await env.POINTS_KV.get(person)) || "0", 10);
      }
      const updatedVal = Math.max(0, current + (body.delta || 0));

      if (env.POINTS_KV) {
        await env.POINTS_KV.put(person, updatedVal.toString());
        const vivi = parseInt((await env.POINTS_KV.get("vivi")) || "0", 10);
        const andy = parseInt((await env.POINTS_KV.get("andy")) || "0", 10);
        return Response.json({ vivi, andy });
      }

      return Response.json({ [person]: updatedVal });
    } catch (err: any) {
      return Response.json({ error: err.message || "Error procesando solicitud" }, { status: 400 });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
};
