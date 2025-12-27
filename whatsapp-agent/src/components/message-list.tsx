import { useMemo } from "react";

export type MessageView = {
  id: string;
  from: string | null;
  timestamp: number;
  type: string;
  text?: string;
  name?: string;
  phoneNumber?: string;
  raw: unknown;
};

type MessageListProps = {
  title: string;
  messages: MessageView[];
  emptyLabel: string;
};

const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function MessageList({
  title,
  messages,
  emptyLabel,
}: MessageListProps) {
  const sorted = useMemo(
    () => [...messages].sort((a, b) => b.timestamp - a.timestamp),
    [messages],
  );

  return (
    <section className="flex flex-1 flex-col rounded-xl border border-zinc-200 bg-white/80 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/70">
      <header className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h2>
      </header>
      <div className="flex-1 overflow-auto">
        {sorted.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
            {emptyLabel}
          </p>
        ) : (
          <ul className="flex flex-col gap-3 p-4">
            {sorted.map((message) => (
              <li
                key={message.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>
                    {message.name ? `${message.name} • ` : ""}
                    {message.from ?? "unknown"}
                  </span>
                  <time dateTime={new Date(message.timestamp).toISOString()}>
                    {formatter.format(message.timestamp)}
                  </time>
                </div>
                <div className="mt-2 text-zinc-900 dark:text-zinc-50">
                  {message.text ?? (
                    <span className="italic text-zinc-500 dark:text-zinc-400">
                      {message.type}
                    </span>
                  )}
                </div>
                <details className="mt-3 rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">
                    Raw payload
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-[11px] leading-4">
                    {JSON.stringify(message.raw, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
