"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { MessageList, type MessageView } from "@/components/message-list";

type FormState = {
  accessToken: string;
  phoneNumberId: string;
  limit: string;
};

type GraphMessage = {
  id: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  [key: string]: unknown;
};

type GraphResponse = {
  messages?: {
    data?: GraphMessage[];
    paging?: {
      cursors?: { before?: string; after?: string };
      next?: string;
      previous?: string;
    };
  };
  id?: string;
};

const STORAGE_KEY = "whatsapp-agent-config";

const DEFAULT_FORM: FormState = {
  accessToken: "",
  phoneNumberId: "",
  limit: "50",
};

type PagingState = {
  before?: string;
  after?: string;
};

function parseGraphMessages(response: GraphResponse | null): MessageView[] {
  if (!response?.messages?.data) {
    return [];
  }

  return response.messages.data
    .filter((message): message is GraphMessage & { id: string } => !!message?.id)
    .map((message) => ({
      id: message.id,
      from: message.from ?? null,
      type: message.type ?? "unknown",
      timestamp:
        message.timestamp !== undefined
          ? Number.parseInt(message.timestamp, 10) * 1000
          : Date.now(),
      text: message.text?.body,
      raw: message,
    }));
}

function extractCursorFromUrl(url: string | undefined, param: "after" | "before") {
  if (!url) {
    return undefined;
  }
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get(param) ?? undefined;
  } catch {
    return undefined;
  }
}

export default function Home() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [remember, setRemember] = useState(false);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [graphResponse, setGraphResponse] = useState<GraphResponse | null>(null);
  const [paging, setPaging] = useState<PagingState>({});
  const graphMessages = useMemo(
    () => parseGraphMessages(graphResponse),
    [graphResponse],
  );

  const [webhookMessages, setWebhookMessages] = useState<MessageView[]>([]);
  const [webhookError, setWebhookError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as FormState & { remember?: boolean };
        setForm({
          accessToken: parsed.accessToken ?? "",
          phoneNumberId: parsed.phoneNumberId ?? "",
          limit: parsed.limit ?? DEFAULT_FORM.limit,
        });
        setRemember(!!parsed.remember);
      }
    } catch (error) {
      console.error("Failed to restore saved config", error);
    }
  }, []);

  useEffect(() => {
    if (!remember) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...form, remember: true }),
    );
  }, [form, remember]);

  const loadGraphMessages = useCallback(
    async (cursor?: string) => {
      if (!form.accessToken || !form.phoneNumberId) {
        setGraphError("Enter your access token and phone number ID.");
        return;
      }

      setGraphLoading(true);
      setGraphError(null);

      try {
        const parsedLimit = Number.parseInt(form.limit, 10);
        const response = await fetch("/api/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessToken: form.accessToken,
            phoneNumberId: form.phoneNumberId,
            limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
            cursor,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Unable to fetch messages");
        }

        const payload = (await response.json()) as GraphResponse;
        setGraphResponse(payload);

        const pagingInfo = payload.messages?.paging;
        setPaging({
          after:
            pagingInfo?.cursors?.after ??
            extractCursorFromUrl(pagingInfo?.next, "after"),
          before:
            pagingInfo?.cursors?.before ??
            extractCursorFromUrl(pagingInfo?.previous, "before"),
        });
      } catch (error) {
        setGraphError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setGraphLoading(false);
      }
    },
    [form.accessToken, form.phoneNumberId, form.limit],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await loadGraphMessages();
    },
    [loadGraphMessages],
  );

  useEffect(() => {
    let mounted = true;

    async function pollWebhookMessages() {
      try {
        const response = await fetch("/api/local-messages", {
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to load webhook messages: ${response.status}`);
        }

        const payload = (await response.json()) as { messages: MessageView[] };
        if (mounted) {
          setWebhookMessages(payload.messages ?? []);
          setWebhookError(null);
        }
      } catch (error) {
        if (mounted) {
          setWebhookError(
            error instanceof Error ? error.message : "Unable to load webhook data",
          );
        }
      }
    }

    pollWebhookMessages();
    const interval = window.setInterval(pollWebhookMessages, 8000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const clearWebhookMessages = useCallback(async () => {
    await fetch("/api/local-messages", { method: "DELETE" });
    setWebhookMessages([]);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100 via-white to-zinc-100 pb-16 pt-10 font-sans text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
        <header className="space-y-3 text-center sm:text-left">
          <p className="text-sm font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            WhatsApp Intake Agent
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            Inspect and monitor WhatsApp conversations
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            Connect your WhatsApp Cloud API credentials to pull history on demand,
            or point your Meta webhook to this deployment to capture real-time
            messages in the right-hand feed.
          </p>
        </header>

        <section className="grid gap-6 rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-xl shadow-zinc-950/5 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/70">
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 sm:grid-cols-2 sm:gap-5"
          >
            <div className="sm:col-span-2">
              <label
                htmlFor="accessToken"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Permanent access token
              </label>
              <input
                id="accessToken"
                name="accessToken"
                autoComplete="off"
                type="password"
                required
                value={form.accessToken}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    accessToken: event.currentTarget.value,
                  }))
                }
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-600/40"
                placeholder="EAAG..."
              />
            </div>
            <div>
              <label
                htmlFor="phoneNumberId"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Phone number ID
              </label>
              <input
                id="phoneNumberId"
                name="phoneNumberId"
                type="text"
                required
                value={form.phoneNumberId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    phoneNumberId: event.currentTarget.value,
                  }))
                }
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-600/40"
                placeholder="123456789012345"
              />
            </div>
            <div>
              <label
                htmlFor="limit"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Page size
              </label>
              <input
                id="limit"
                name="limit"
                type="number"
                min={1}
                max={100}
                value={form.limit}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    limit: event.currentTarget.value,
                  }))
                }
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-600/40"
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="remember"
                name="remember"
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.currentTarget.checked)}
                className="h-4 w-4 rounded border border-zinc-400 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-900"
              />
              <label
                htmlFor="remember"
                className="text-sm text-zinc-600 dark:text-zinc-400"
              >
                Remember credentials locally (stored in your browser only)
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                disabled={graphLoading}
              >
                {graphLoading ? "Loading..." : "Load messages"}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-900"
                onClick={() => loadGraphMessages(paging.after)}
                disabled={!paging.after || graphLoading}
              >
                Load newer
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-900"
                onClick={() => loadGraphMessages(paging.before)}
                disabled={!paging.before || graphLoading}
              >
                Load older
              </button>
              <button
                type="button"
                onClick={clearWebhookMessages}
                className="ml-auto inline-flex items-center justify-center rounded-lg border border-transparent bg-zinc-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-700 transition hover:bg-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Clear webhook cache
              </button>
            </div>
            {graphError ? (
              <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
                {graphError}
              </p>
            ) : null}
            {webhookError ? (
              <p className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                {webhookError}
              </p>
            ) : null}
          </form>

          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-100/60 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            <h3 className="font-medium text-zinc-700 dark:text-zinc-200">
              Quick setup checklist
            </h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Generate a long-lived access token in Meta Business Manager.</li>
              <li>Copy the phone number ID from your WhatsApp app configuration.</li>
              <li>
                Paste both values above and click <strong>Load messages</strong>.
              </li>
              <li>
                Configure the webhook callback URL{" "}
                <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-100 dark:bg-zinc-950">
                  /api/webhook
                </code>{" "}
                and set{" "}
                <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-100 dark:bg-zinc-950">
                  WHATSAPP_VERIFY_TOKEN
                </code>{" "}
                to match your Meta app settings.
              </li>
            </ol>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <MessageList
            title="Graph API messages"
            messages={graphMessages}
            emptyLabel="Load messages with the form above to populate this feed."
          />
          <MessageList
            title="Live webhook stream"
            messages={webhookMessages}
            emptyLabel="Point your WhatsApp webhook to /api/webhook to capture inbound traffic."
          />
        </section>
      </main>
    </div>
  );
}
