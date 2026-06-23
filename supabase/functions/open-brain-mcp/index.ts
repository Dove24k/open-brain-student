// open-brain-mcp
// This Supabase Edge Function acts as an MCP server for your Open Brain database.
// This version intentionally avoids backtick characters so copy and paste issues cannot break it.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MCP_ACCESS_KEY = Deno.env.get("MCP_ACCESS_KEY") || "";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function jsonRpcResult(id: unknown, result: unknown) {
  return jsonResponse({
    jsonrpc: "2.0",
    id: id,
    result: result
  });
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return jsonResponse({
    jsonrpc: "2.0",
    id: id,
    error: {
      code: code,
      message: message
    }
  });
}

function isAuthorized(request: Request) {
  const authHeader = request.headers.get("Authorization") || "";
  const expectedHeader = "Bearer " + MCP_ACCESS_KEY;
  return MCP_ACCESS_KEY.length > 0 && authHeader === expectedHeader;
}

function supabaseHeaders() {
  return {
    "Content-Type": "application/json",
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": "Bearer " + SUPABASE_SERVICE_ROLE_KEY
  };
}

function getToolList() {
  return {
    tools: [
      {
        name: "search_thoughts",
        description: "Search the user's Open Brain thoughts by text content. Use this when the user asks about something they may have saved before.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search text to look for in saved thoughts."
            }
          },
          required: ["query"]
        }
      },
      {
        name: "list_recent",
        description: "List the most recent thoughts saved in the user's Open Brain.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "How many recent thoughts to return. Defaults to 10."
            }
          },
          required: []
        }
      },
      {
        name: "add_thought",
        description: "Add a new thought to the user's Open Brain database.",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The thought content to save."
            }
          },
          required: ["content"]
        }
      }
    ]
  };
}

async function searchThoughts(query: string) {
  const url = SUPABASE_URL + "/rest/v1/thoughts?select=id,content,created_at&content=ilike." + encodeURIComponent("*" + query + "*") + "&order=created_at.desc&limit=10";

  const response = await fetch(url, {
    method: "GET",
    headers: supabaseHeaders()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("Search failed: " + response.status + " " + errorText);
  }

  return await response.json();
}

async function listRecent(limit = 10) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const url = SUPABASE_URL + "/rest/v1/thoughts?select=id,content,created_at&order=created_at.desc&limit=" + safeLimit;

  const response = await fetch(url, {
    method: "GET",
    headers: supabaseHeaders()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("Recent failed: " + response.status + " " + errorText);
  }

  return await response.json();
}

async function addThought(content: string) {
  const url = SUPABASE_URL + "/rest/v1/thoughts?select=id,content,created_at";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      "Prefer": "return=representation"
    },
    body: JSON.stringify({
      content: content
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("Insert failed: " + response.status + " " + errorText);
  }

  const rows = await response.json();
  return rows[0] || null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({
      error: "Method not allowed. Use POST."
    }, 405);
  }

  if (!isAuthorized(request)) {
    return jsonResponse({
      error: "Unauthorized. Missing or invalid MCP access key."
    }, 401);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonRpcError(null, -32603, "Missing Supabase environment variables.");
  }

  let body: any;

  try {
    body = await request.json();
  } catch (_error) {
    return jsonRpcError(null, -32700, "Invalid JSON.");
  }

  const id = body.id ?? null;
  const method = body.method;
  const params = body.params ?? {};

  try {
    if (method === "initialize") {
      return jsonRpcResult(id, {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "open-brain-mcp",
          version: "1.0.0"
        }
      });
    }

    if (method === "notifications/initialized") {
      return jsonRpcResult(id, {});
    }

    if (method === "tools/list") {
      return jsonRpcResult(id, getToolList());
    }

    if (method === "tools/call") {
      const toolName = params.name;
      const args = params.arguments || {};

      if (toolName === "search_thoughts") {
        if (!args.query || typeof args.query !== "string") {
          return jsonRpcError(id, -32602, "search_thoughts requires a query string.");
        }

        const results = await searchThoughts(args.query);

        return jsonRpcResult(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2)
            }
          ]
        });
      }

      if (toolName === "list_recent") {
        const results = await listRecent(args.limit || 10);

        return jsonRpcResult(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2)
            }
          ]
        });
      }

      if (toolName === "add_thought") {
        if (!args.content || typeof args.content !== "string") {
          return jsonRpcError(id, -32602, "add_thought requires a content string.");
        }

        const savedThought = await addThought(args.content);

        return jsonRpcResult(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(savedThought, null, 2)
            }
          ]
        });
      }

      return jsonRpcError(id, -32601, "Unknown tool: " + toolName);
    }

    return jsonRpcError(id, -32601, "Method not found: " + method);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonRpcError(id, -32603, message);
  }
});
