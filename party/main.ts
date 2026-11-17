import { PartyKitServer } from "partykit/server";

export default {
  async onConnect(conn, room) {
    // 1. Al conectar un nuevo cliente, le enviamos el puntaje guardado
    const vivi = (await room.storage.get<number>("vivi")) ?? 0;
    const andy = (await room.storage.get<number>("andy")) ?? 0;
    conn.send(JSON.stringify({ type: "SYNC", data: { vivi, andy } }));
  },

  async onMessage(message, sender, room) {
    try {
      const data = JSON.parse(message as string);

      if (data.type === "UPDATE_POINTS") {
        if (data.pin !== "0000") {
          sender.send(JSON.stringify({ type: "ERROR", message: "Clave incorrecta" }));
          return;
        }

        const person = data.person?.toLowerCase()?.trim();
        if (person !== "vivi" && person !== "andy") return;

        const current = (await room.storage.get<number>(person)) ?? 0;
        const delta = Number(data.delta || 0);
        const updated = Math.max(0, Math.round((current + delta) * 10) / 10);

        // Guardado permanente en Cloudflare Durable Objects
        await room.storage.put(person, updated);

        const vivi = (await room.storage.get<number>("vivi")) ?? 0;
        const andy = (await room.storage.get<number>("andy")) ?? 0;

        // Broadcast instantáneo a TODOS los celulares conectados (0ms delay)
        room.broadcast(JSON.stringify({ type: "SYNC", data: { vivi, andy } }));
      }
    } catch (e) {}
  },

  async onRequest(req, room) {
    // API REST de respaldo si alguien hace fetch HTTP
    const vivi = (await room.storage.get<number>("vivi")) ?? 0;
    const andy = (await room.storage.get<number>("andy")) ?? 0;
    return Response.json({ vivi, andy }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST",
      }
    });
  }
} satisfies PartyKitServer;
