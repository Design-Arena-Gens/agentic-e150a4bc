import { NextResponse } from "next/server";
import { webhookStore, type StoredMessage } from "@/lib/webhookStore";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && challenge) {
    if (!VERIFY_TOKEN) {
      return NextResponse.json(
        { error: "Missing WHATSAPP_VERIFY_TOKEN env value" },
        { status: 500 },
      );
    }

    if (token === VERIFY_TOKEN) {
      return new NextResponse(challenge, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  return NextResponse.json({ success: false }, { status: 400 });
}

function extractMessages(body: unknown) {
  if (
    typeof body !== "object" ||
    body === null ||
    !("entry" in body) ||
    !Array.isArray((body as { entry: unknown }).entry)
  ) {
    return [];
  }

  const entries = (body as { entry: unknown[] }).entry;
  const aggregated: StoredMessage[] = [];

  for (const entry of entries) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("changes" in entry) ||
      !Array.isArray((entry as { changes: unknown }).changes)
    ) {
      continue;
    }

    const changes = (entry as { changes: unknown[] }).changes;
    for (const change of changes) {
      if (
        typeof change !== "object" ||
        change === null ||
        !("value" in change) ||
        typeof (change as { value: unknown }).value !== "object" ||
        (change as { value: unknown }).value === null
      ) {
        continue;
      }

      const value = (change as { value: Record<string, unknown> }).value;
      if (!Array.isArray(value.messages)) {
        continue;
      }

      const contacts = Array.isArray(value.contacts)
        ? value.contacts
        : [];

      for (const message of value.messages) {
        if (
          typeof message !== "object" ||
          message === null ||
          typeof (message as { id?: unknown }).id !== "string"
        ) {
          continue;
        }

        const typed = message as Record<string, unknown>;

        const contact =
          contacts.find(
            (cta) =>
              typeof cta === "object" &&
              cta !== null &&
              "wa_id" in (cta as Record<string, unknown>) &&
              (cta as { wa_id?: unknown }).wa_id === typed.from,
          ) ?? null;

        const stored: StoredMessage = {
          id: typed.id as string,
          from:
            typeof typed.from === "string"
              ? (typed.from as string)
              : null,
          type:
            typeof typed.type === "string"
              ? (typed.type as string)
              : "unknown",
          text:
            typed.type === "text" && typed.text && typeof typed.text === "object"
              ? ((typed.text as { body?: string }).body ?? undefined)
              : undefined,
          timestamp:
            typeof typed.timestamp === "string"
              ? Number.parseInt(typed.timestamp, 10) * 1000
              : Date.now(),
          name:
            contact && typeof contact === "object"
              ? ((contact as { profile?: { name?: string } }).profile
                  ?.name ?? undefined)
              : undefined,
          phoneNumber:
            contact && typeof contact === "object"
              ? ((contact as { wa_id?: string }).wa_id ?? undefined)
              : undefined,
          raw: message,
        };

        aggregated.push(stored);
      }
    }
  }

  return aggregated;
}

export async function POST(request: Request) {
  const signature = request.headers.get("x-hub-signature-256");

  try {
    const body = await request.json();
    const messages = extractMessages(body);

    messages.forEach((message) => {
      webhookStore.add(message);
    });

    return NextResponse.json({
      success: true,
      received: messages.length,
      signature,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to process webhook payload",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
