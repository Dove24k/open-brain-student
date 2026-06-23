const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TelegramUpdate = {
  message?: {
    chat: {
      id: number;
    };
    text?: string;
  };
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function sendTelegramMessage(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("Missing TELEGRAM_BOT_TOKEN");
    return;
  }

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}

async function insertThought(text: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/thoughts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({
      content: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Insert failed: ${response.status} ${errorText}`);
  }
}

async function searchThoughts(query: string) {
  const url =
    `${SUPABASE_URL}/rest/v1/thoughts?select=content,created_at&content=ilike.*${encodeURIComponent(query)}*&order=created_at.desc&limit=5`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Search failed: ${response.status} ${errorText}`);
  }

  return await response.json();
}

async function getRecentThoughts() {
  const url =
    `${SUPABASE_URL}/rest/v1/thoughts?select=content,created_at&order=created_at.desc&limit=5`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Recent failed: ${response.status} ${errorText}`);
  }

  return await response.json();
}

function formatThoughts(thoughts: Array<{ content: string; created_at?: string }>) {
  if (!thoughts || thoughts.length === 0) {
    return "No matching thoughts found.";
  }

  return thoughts
    .map((thought, index) => {
      const content = thought.content ?? "";
      return `${index + 1}. ${content}`;
    })
    .join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response("This function expects POST requests from Telegram.", {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    const update = (await req.json()) as TelegramUpdate;
    const chatId = update.message?.chat?.id;
    const text = update.message?.text?.trim();

    if (!chatId || !text) {
      return new Response("No message to process.", {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (text.startsWith("/recent")) {
      const recent = await getRecentThoughts();
      await sendTelegramMessage(chatId, formatThoughts(recent));
      return new Response("ok", {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (text.startsWith("/search") || text.startsWith("?")) {
      const query = text.startsWith("/search")
        ? text.replace("/search", "").trim()
        : text.replace("?", "").trim();

      if (!query) {
        await sendTelegramMessage(chatId, "Send /search followed by what you want to find. Example: /search habits");
        return new Response("ok", {
          status: 200,
          headers: corsHeaders,
        });
      }

      const results = await searchThoughts(query);
      await sendTelegramMessage(chatId, formatThoughts(results));

      return new Response("ok", {
        status: 200,
        headers: corsHeaders,
      });
    }

    await insertThought(text);
    await sendTelegramMessage(chatId, "Saved to your brain.");

    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error(error);
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }
});
