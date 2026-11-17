import { PointsTrackerDO } from "./durable-object";

export { PointsTrackerDO };

interface Env {
  POINTS_TRACKER_DO?: DurableObjectNamespace;
  POINTS_KV?: KVNamespace;
  SECURITY_PIN?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // Si Durable Object está disponible y configurado
  if (env.POINTS_TRACKER_DO) {
    const id = env.POINTS_TRACKER_DO.idFromName("global_points_room");
    const obj = env.POINTS_TRACKER_DO.get(id);
    return obj.fetch(request);
  }

  // Fallback con Cloudflare KV
  if (request.method === "GET") {
    let vivi = 0;
    let andy = 0;
    if (env.POINTS_KV) {
      vivi = parseFloat((await env.POINTS_KV.get("vivi")) || "0");
      andy = parseFloat((await env.POINTS_KV.get("andy")) || "0");
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
        current = parseFloat((await env.POINTS_KV.get(person)) || "0");
      }
      const updatedVal = Math.max(0, Math.round((current + Number(body.delta || 0)) * 10) / 10);

      if (env.POINTS_KV) {
        await env.POINTS_KV.put(person, updatedVal.toString());
        const vivi = parseFloat((await env.POINTS_KV.get("vivi")) || "0");
        const andy = parseFloat((await env.POINTS_KV.get("andy")) || "0");
        return Response.json({ vivi, andy });
      }

      return Response.json({ [person]: updatedVal });
    } catch (err: any) {
      return Response.json({ error: err.message || "Error procesando solicitud" }, { status: 400 });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
};
