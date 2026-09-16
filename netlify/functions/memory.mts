import { getStore } from "@netlify/blobs";
import type { Context, Config } from "@netlify/functions";

interface UserMemory {
  userName: string;
  userInterests: string[];
  facts: string[];
  notes: string;
  conversationHighlights: string[];
  updatedAt: string;
}

const DEFAULT_MEMORY: UserMemory = {
  userName: "",
  userInterests: [],
  facts: [
    "Companion Raya initialized with Netlify Blobs persistent database.",
    "Raya prefers warm, casual, friendly chats and companionship."
  ],
  notes: "Persistent companion memory managed by Netlify Blobs database.",
  conversationHighlights: [],
  updatedAt: new Date().toISOString()
};

export default async (req: Request, context: Context) => {
  const method = req.method.toUpperCase();

  try {
    // Connect to Netlify Blobs store
    const store = getStore("raya-companion");

    // 1. GET: Retrieve stored companion memory and user profile
    if (method === "GET") {
      const stored = await store.get("user-profile", { type: "json" });
      const memory: UserMemory = stored || DEFAULT_MEMORY;
      return new Response(JSON.stringify(memory), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. POST: Save or update user memory in Netlify Blobs
    if (method === "POST") {
      const body = await req.json();
      const existing: UserMemory = (await store.get("user-profile", { type: "json" })) || DEFAULT_MEMORY;

      const updatedMemory: UserMemory = {
        userName: typeof body.userName === "string" ? body.userName.trim() : existing.userName,
        userInterests: Array.isArray(body.userInterests)
          ? Array.from(new Set([...existing.userInterests, ...body.userInterests]))
          : existing.userInterests,
        facts: Array.isArray(body.facts)
          ? Array.from(new Set([...existing.facts, ...body.facts]))
          : existing.facts,
        notes: typeof body.notes === "string" ? body.notes : existing.notes,
        conversationHighlights: Array.isArray(body.conversationHighlights)
          ? [...existing.conversationHighlights, ...body.conversationHighlights].slice(-20)
          : existing.conversationHighlights,
        updatedAt: new Date().toISOString()
      };

      // Store in Netlify Blobs Database
      await store.setJSON("user-profile", updatedMemory);

      return new Response(JSON.stringify({ success: true, memory: updatedMemory }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. DELETE: Reset memory in Netlify Blobs
    if (method === "DELETE") {
      await store.setJSON("user-profile", {
        ...DEFAULT_MEMORY,
        updatedAt: new Date().toISOString()
      });

      return new Response(JSON.stringify({ success: true, message: "Memory reset successfully" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: `Method ${method} not allowed` }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error("[Netlify Memory Function Error]:", err);
    return new Response(
      JSON.stringify({
        error: err.message || "Failed to process database request",
        fallback: true
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

export const config: Config = {
  path: "/api/memory"
};
