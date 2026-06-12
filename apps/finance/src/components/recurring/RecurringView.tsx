"use client";

import { useMemo, useState } from "react";
import { FiTag } from "react-icons/fi";
import PageContainer from "../layout/PageContainer";
import DynamicIcon from "../DynamicIcon";
import { useUser } from "../providers/UserProvider";
import { useAuthedQuery } from "../../lib/api/useAuthedQuery";
import { formatCurrency } from "../../lib/formatCurrency";
import {
  type RecurringStream,
  estimatedMonthlyTotal,
  frequencyLabel,
  nextDateLabel,
  splitStreams,
  streamName,
} from "./lib";

const DISABLE_LOGOS = process.env.NEXT_PUBLIC_DISABLE_MERCHANT_LOGOS === "1";

type RecurringResponse = { recurring: RecurringStream[] };

function StreamRow({ stream, now }: { stream: RecurringStream; now: Date }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const name = streamName(stream);
  const showLogo = !DISABLE_LOGOS && !!stream.icon_url && !logoFailed;

  return (
    <div className="flex items-center gap-4 py-3">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden shrink-0"
        style={{
          backgroundColor: showLogo
            ? "transparent"
            : stream.category_hex_color || "var(--color-accent)",
        }}
      >
        {showLogo ? (
          <img
            src={stream.icon_url as string}
            alt={name}
            className="w-full h-full object-cover rounded-full"
            loading="lazy"
            decoding="async"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <DynamicIcon
            iconLib={stream.category_icon_lib}
            iconName={stream.category_icon_name}
            className="h-5 w-5 text-white"
            fallback={FiTag}
            style={{ strokeWidth: 2.5 }}
          />
        )}
      </div>
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

export default function RecurringView() {
  const { user } = useUser();
  // Bills & subscriptions only — income streams (salary, interest) are
  // excluded server-side via streamType=outflow per owner verdict.
  const { data, isLoading, error } = useAuthedQuery<RecurringResponse>(
    ["recurring:list:outflow", user?.id],
    user?.id ? "/api/recurring/get?streamType=outflow" : null,
  );

  const now = useMemo(() => new Date(), []);
  const { outflows } = useMemo(() => splitStreams(data?.recurring ?? []), [data]);
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
          <p className="text-sm font-medium text-[var(--color-fg)]">Bills &amp; subscriptions is a Pro feature</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Upgrade to see your detected bills and subscriptions in one place.
          </p>
        </div>
      ) : error ? (
        <div className="py-16 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            Couldn&apos;t load your bills. Try again in a moment.
          </p>
        </div>
      ) : outflows.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-[var(--color-fg)]">No bills detected yet</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Detected bills and subscriptions will appear here after a few
            transaction cycles.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          <div>
            <div className="card-header">Est. monthly cost</div>
            <div className="mt-2 text-3xl sm:text-4xl font-medium tracking-tight tabular-nums text-[var(--color-fg)]">
              {formatCurrency(monthlyTotal)}
            </div>
            <div className="mt-1 text-[11px] text-[var(--color-muted)]">
              {outflows.length} recurring {outflows.length === 1 ? "payment" : "payments"}
              {dueThisWeek.length > 0 && ` · ${dueThisWeek.length} due within a week`}
            </div>
          </div>
          <section>
            <h2 className="card-header">Subscriptions &amp; bills</h2>
            <div className="divide-y divide-[var(--color-border)]">
              {outflows.map((s) => (
                <StreamRow key={s.stream_id} stream={s} now={now} />
              ))}
            </div>
          </section>
        </div>
      )}
    </PageContainer>
  );
}
