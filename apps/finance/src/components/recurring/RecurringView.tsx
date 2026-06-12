"use client";

import { useMemo } from "react";
import Image from "next/image";
import PageContainer from "../layout/PageContainer";
import { useUser } from "../providers/UserProvider";
import { useAuthedQuery } from "../../lib/api/useAuthedQuery";
import { formatCurrency } from "../../lib/formatCurrency";
import {
  type RecurringStream,
  estimatedMonthlyTotal,
  frequencyLabel,
  monthlyAmount,
  nextDateLabel,
  splitStreams,
  streamName,
} from "./lib";

type RecurringResponse = { recurring: RecurringStream[] };

function StreamRow({ stream, now }: { stream: RecurringStream; now: Date }) {
  const name = streamName(stream);
  return (
    <div className="flex items-center gap-3 py-3">
      {stream.icon_url ? (
        <Image
          src={stream.icon_url}
          alt=""
          width={28}
          height={28}
          className="rounded-full shrink-0"
          unoptimized
        />
      ) : (
        <div
          className="w-7 h-7 rounded-full shrink-0"
          style={{ backgroundColor: stream.category_hex_color || "var(--color-surface-alt)" }}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--color-fg)] truncate">{name}</div>
        <div className="text-[11px] text-[var(--color-muted)]">
          {frequencyLabel(stream.frequency)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-medium tabular-nums text-[var(--color-fg)]">
          {formatCurrency(stream.average_amount)}
        </div>
        <div className="text-[11px] text-[var(--color-muted)]">
          {nextDateLabel(stream.predicted_next_date, now)}
        </div>
      </div>
    </div>
  );
}

function Section({ title, streams, now }: { title: string; streams: RecurringStream[]; now: Date }) {
  if (streams.length === 0) return null;
  return (
    <section>
      <h2 className="card-header">{title}</h2>
      <div className="divide-y divide-[var(--color-border)]">
        {streams.map((s) => (
          <StreamRow key={s.stream_id} stream={s} now={now} />
        ))}
      </div>
    </section>
  );
}

export default function RecurringView() {
  const { user } = useUser();
  const { data, isLoading, error } = useAuthedQuery<RecurringResponse>(
    ["recurring:list", user?.id],
    user?.id ? "/api/recurring/get" : null,
  );

  const now = useMemo(() => new Date(), []);
  const { outflows, inflows } = useMemo(
    () => splitStreams(data?.recurring ?? []),
    [data],
  );
  const monthlyTotal = useMemo(() => estimatedMonthlyTotal(outflows), [outflows]);
  const dueThisWeek = useMemo(
    () =>
      outflows.filter((s) => {
        const label = nextDateLabel(s.predicted_next_date, now);
        return label === "Due" || label === "Today" || label === "Tomorrow" ||
          (label.startsWith("In ") && Number(label.split(" ")[1]) <= 7);
      }),
    [outflows, now],
  );

  const locked = error?.message.startsWith("403");

  return (
    <PageContainer>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded bg-[var(--color-surface-alt)] animate-pulse" />
          ))}
        </div>
      ) : locked ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-[var(--color-fg)]">Recurring is a Pro feature</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Upgrade to see detected subscriptions, bills, and recurring income.
          </p>
        </div>
      ) : error ? (
        <div className="py-16 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            Couldn&apos;t load recurring activity. Try again in a moment.
          </p>
        </div>
      ) : outflows.length === 0 && inflows.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-[var(--color-fg)]">No recurring activity yet</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Detected subscriptions, bills, and income will appear here after a
            few transaction cycles.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          <div>
            <div className="card-header">Est. monthly outflow</div>
            <div className="mt-2 text-3xl sm:text-4xl font-medium tracking-tight tabular-nums text-[var(--color-fg)]">
              {formatCurrency(monthlyTotal)}
            </div>
            <div className="mt-1 text-[11px] text-[var(--color-muted)]">
              {outflows.length} recurring {outflows.length === 1 ? "payment" : "payments"}
              {dueThisWeek.length > 0 && ` · ${dueThisWeek.length} due within a week`}
            </div>
          </div>
          <Section title="Subscriptions & bills" streams={outflows} now={now} />
          <Section title="Recurring income" streams={inflows} now={now} />
        </div>
      )}
    </PageContainer>
  );
}
