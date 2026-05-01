# UI Style Guide

The dashboard has been updated to the new style. Use this guide when updating the rest of the app to match.

## Core Principles

- **No card backgrounds.** Components sit directly on the page background. No `bg-white`, no `bg-[var(--color-surface)]`, no `--glass-bg`. The older card styling (`--glass-bg`, `--glass-border`, `--glass-shadow`) should be removed as pages are updated.
- **Flat and minimal.** No shadows, no glassmorphism, no heavy borders. Hierarchy comes from typography and spacing, not visual decoration.
- **Muted, desaturated palette.** The base UI is grayscale (zinc scale). Saturated color is reserved exclusively for financial sentiment (green = gain, red = loss).
- **Every element earns its place.** No decorative icons, no badge pills, no unnecessary embellishments. If it doesn't communicate information, remove it.

## Colors

### CSS Variables (use for all UI chrome)

| Variable | Light | Dark | Usage |
|---|---|---|---|
| `--color-fg` | `#18181b` | `#e4e4e7` | Primary text, hero numbers, active elements |
| `--color-muted` | `#52525b` | `#a1a1aa` | Secondary text, labels, descriptions, inactive states |
| `--color-border` | `#e4e4e7` | `#3f3f46` | Subtle dividers, skeleton loaders, inactive progress bars |
| `--color-surface-alt` | `#f1f1f1` | `#181818` | Hover backgrounds, input backgrounds, inactive fills |
| `--color-accent` | `#18181b` | `#fafafa` | Primary buttons, CTAs (maps to primary) |
| `--color-on-accent` | `#ffffff` | `#09090b` | Text on accent backgrounds |

### Tailwind Semantic Colors (use only for financial sentiment)

| Color | Usage |
|---|---|
| `emerald-500` | Positive: gains, income, under budget, good trends |
| `rose-500` | Negative: losses, overspending, over budget, bad trends |
| `amber-500` | Warning: approaching budget limit (>85%) |

**Never mix these.** Don't use `blue-500`, `purple-500`, or other Tailwind colors for UI elements. Keep to the grayscale CSS variables for everything except sentiment.

### Opacity

Use Tailwind's `/` opacity modifier sparingly. When differentiating primary from secondary numbers, use `--color-muted` directly rather than `--color-fg` at reduced opacity. Example: previous month's spending amount is `text-[var(--color-muted)]`, not `text-[var(--color-fg)]/40`.

## Typography

### Hierarchy

| Role | Classes | Example |
|---|---|---|
| Section header | `.card-header` (global class) | `MONTHLY SPENDING`, `INSIGHTS` |
| Hero number (primary) | `text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-fg)]` | Current month total |
| Hero number (secondary) | `text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-muted)]` | Previous month total |
| Metric change | `text-xs font-semibold` + sentiment color | `+12%`, `-5%` |
| Body text | `text-sm text-[var(--color-fg)]` | Insight messages, descriptions |
| Body text (emphasis) | `text-sm font-medium text-[var(--color-fg)]` | Important body content |
| Small label | `text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider` | Inline labels like "This month" |
| Meta / tiny | `text-[10px] text-[var(--color-muted)]` | Tooltip dates, footnotes |

### The `.card-header` Class

Every section uses this for its title. Defined in `globals.css`:

```css
.card-header {
  font-size: 0.6875rem;      /* 11px */
  font-weight: 600;
  color: var(--color-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1;
}
```

### Money & Numbers

- Always use `tabular-nums` on currency amounts for proper alignment
- Large amounts use `tracking-tight` to keep numbers compact
- Use the `<CurrencyAmount>` component for formatted currency values
- Percent changes use arrow symbols: `▲` for up, `▼` for down (not icon components)
- Directional UI uses chevrons (`‹ ›`), not arrow icons

## Spacing

### Standard Scale

Stick to Tailwind's default spacing scale. Common values used in the dashboard:

| Spacing | Value | Usage |
|---|---|---|
| `gap-1.5` / `gap-2` | 6-8px | Icon + label pairs, tight element groups |
| `gap-3` / `gap-4` | 12-16px | Elements within a section |
| `gap-6` | 24px | `mb-6` between header row and content |
| `gap-8` | 32px | Side-by-side stat groups |
| `gap-10` | 40px | Between dashboard sections/cards, grid gaps |

### Section Anatomy

```
[card-header + controls]    ← flex justify-between, mb-6
[hero numbers / stats]      ← mb-6
[chart or list content]     ← flex-1
```

The consistent `mb-6` between header, stats, and content creates rhythm.

## Component Patterns

### Section Structure (No Cards)

```tsx
<div>
  <div className="flex items-center justify-between mb-6">
    <div className="card-header">Section Title</div>
    {/* Optional: dropdown, tabs, "View all" link */}
  </div>
  {/* Content directly beneath, no wrapper */}
</div>
```

### Loading Skeletons

Use `animate-pulse` with `bg-[var(--color-border)]` and `rounded`:

```tsx
<div className="animate-pulse">
  <div className="h-3 w-28 bg-[var(--color-border)] rounded mb-4" />
  <div className="h-9 w-24 bg-[var(--color-border)] rounded mb-2" />
  <div className="space-y-2">
    <div className="h-3.5 w-full bg-[var(--color-border)] rounded" />
    <div className="h-3.5 w-2/3 bg-[var(--color-border)] rounded" />
  </div>
</div>
```

Match skeleton shapes to the real content. Skeleton for a hero number should be `h-9 w-24`, not `h-4 w-full`.

### List Item Hover

Full-width hover targets using negative margins:

```tsx
<div className="group hover:bg-[var(--color-surface-alt)]/40 -mx-2 px-2 py-3.5 rounded-lg transition-colors cursor-pointer">
  {/* Content */}
</div>
```

### Small Interactive Buttons

```tsx
<button className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors">
```

### Progress Bars

```tsx
<div className="h-1.5 w-full bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
  <div
    className={`h-full rounded-full transition-all duration-500 ease-out ${
      pct >= 100 ? 'bg-rose-500' : pct > 85 ? 'bg-amber-500' : 'bg-[var(--color-accent)]'
    }`}
    style={{ width: `${Math.min(pct, 100)}%` }}
  />
</div>
```

### Accent Bar (Tone Indicator)

A 4px vertical bar on the left edge, colored by sentiment:

```tsx
<div className="relative pl-4">
  <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-full ${accentColor}`} />
  {/* Content */}
</div>
```

Colors: `bg-emerald-500` (positive), `bg-rose-500` (negative), `bg-[var(--color-muted)]` (neutral).

### Empty States

Centered, minimal text with an optional CTA:

```tsx
<div className="flex-1 flex flex-col items-center justify-center text-center">
  <div className="text-sm text-[var(--color-fg)] mb-1">No data yet</div>
  <p className="text-xs text-[var(--color-muted)] mb-4">Description of what to do</p>
  <Link className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--color-accent)] text-[var(--color-on-accent)]">
    Action
  </Link>
</div>
```

## Layout

### Dashboard Grid

```tsx
<div className="grid grid-cols-1 lg:grid-cols-10 gap-10">
  <div className="lg:col-span-7 space-y-10">{/* Main content */}</div>
  <div className="lg:col-span-3 space-y-10">{/* Sidebar */}</div>
</div>
```

### Responsive Rows

```tsx
<div className="flex flex-col lg:flex-row gap-10">
  <div className="lg:flex-1 lg:min-w-0">{/* Flexible side */}</div>
  <div className="lg:w-[320px] lg:flex-shrink-0">{/* Fixed sidebar element */}</div>
</div>
```

## Animation

### Framer Motion Defaults

| Animation | Duration | Ease |
|---|---|---|
| Content swap (fade) | `0.15s` | default |
| Slide in/out | `0.2s` | `easeOut` |
| Accent bar scale | `0.25s` | `easeOut` |
| Progress bar fill | `0.5s` | CSS `transition-all duration-500` |

### Hover Transitions

Always add `transition-colors` to elements with hover color/background changes. Never leave a hover state without a transition.

## Agent widgets

Inline widgets rendered inside the `/agent` chat (anything under
`apps/finance/src/components/agent/widgets/`) follow the same core
principles as the rest of the app — **flat, minimal, no card chrome**
— but with a few widget-specific conventions that exist because
they sit inside a streamed message.

### Frame and chrome

- Wrap every widget in `<WidgetFrame>` (from `primitives.tsx`). It
  provides the `my-5` vertical rhythm and the optional first-mount
  fade. **Never add a border, background, padding, or shadow on top
  of WidgetFrame.** A widget should sit directly on the chat
  background just like dashboard sections sit on the page background.
- No `bg-[var(--color-surface-alt)]/30`, no `border`, no
  `rounded-xl p-4` outer wrapper. If you reach for those, look at
  `TransactionListWidget` or `BudgetListWidget` instead — they're the
  reference style.

### Row pattern (use everywhere)

The list-row pattern across `TransactionListWidget`, `BudgetListWidget`,
`AccountListWidget`, and `RecategorizationWidget` is intentionally the
same shape. Match it for any new widget that displays a transaction-,
account-, or category-flavored row:

```tsx
<div className="flex items-center justify-between gap-3 py-2.5">
  <div className="flex items-center gap-3 min-w-0">
    <Icon /* 7×7, rounded-full, group color bg */ />
    <div className="min-w-0">
      <div className="text-sm text-[var(--color-fg)] truncate">{primary}</div>
      <div className="text-[11px] text-[var(--color-muted)] truncate">{meta}</div>
    </div>
  </div>
  <div className="text-sm tabular-nums flex-shrink-0">{trailing}</div>
</div>
```

### Category icons

Always use the **category group's** `icon_lib` / `icon_name` /
`hex_color`, not the leaf category's. The transactions page does the
same — group color and group icon read consistently across the app.
Render with `<DynamicIcon>` and `fallback={FiTag}` so missing data
falls back to a tag glyph instead of crashing.

### No badge pills

Do not render category names (or anything else) as colored pill-shaped
badges. Use a small colored dot/circle with the group icon plus plain
text, the same way `CategoryLine` in `RecategorizationWidget` does.
Pills add visual weight without information.

### Confirmation actions

For accept/decline-style widgets, use **icon-only circular buttons in
the bottom-right** with sentiment colors **only on hover** — neutral
muted by default so they don't compete with the body of the message.
emerald-500 for accept, rose-500 for decline:

```tsx
<button className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[var(--color-muted)] hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors">
  <FiCheck className="h-4 w-4" strokeWidth={2.5} />
</button>
```

Do not use full-width filled buttons for accept/decline inside a chat
widget — they read as a form, not as a quick interaction.

### Animations

- **First mount of a fresh message**: each row uses `<MagicItem>` for
  the scattered-stagger blur entrance. The chat page sets
  `<AnimateProvider animate>` on messages whose id starts with `local-`
  (just streamed in). Historical messages render instantly.
- **State swaps within a widget** (proposal → accepted, page N → N+1):
  use `<AnimatePresence>` with directional motion. Suppress per-row
  `MagicItem` during a swap by wrapping the new state in
  `<AnimateProvider animate={false}>` — otherwise the slide and the
  stagger compound and feel busy.
- **Pagination**: see `TransactionListWidget`'s split between first
  render (MagicItem stagger) and page-swap (slide + small per-row
  fade-up). Mirror that split for any future paginated widget.

### What to avoid in widgets

- Card-style outer wrappers (border / bg / padding / shadow / radius).
- Pill-shaped colored badges around category labels.
- Full-width filled buttons for inline accept/decline.
- Saturated colors anywhere except sentiment (emerald = accept/positive,
  rose = decline/negative).
- Hardcoded colors — always go through CSS variables or sentiment Tailwind classes.
- Skipping `WidgetFrame` (every widget needs that wrapper for vertical rhythm).

## What to Avoid

- **Card wrappers with backgrounds** — no `bg-white`, no `bg-[var(--glass-bg)]`, no box shadows on section containers
- **Decorative icons** — don't add icons next to labels just for decoration. The accent bar or color alone carries sentiment.
- **Tailwind color classes for UI chrome** — no `text-gray-600`, `bg-gray-100`. Use CSS variables.
- **Saturated colors for non-sentiment purposes** — no `text-blue-500` for links, no `bg-purple-100` for badges
- **Badge pills** — don't use colored pill-shaped badges. Use plain text with the appropriate weight/color.
- **Hardcoded colors** — always use CSS variables so light/dark mode works automatically
- **Hover states without transitions** — every interactive color change needs `transition-colors`
- **Fixed heights on flexible content** — use `flex-1` and `min-h-0` for charts, not hardcoded heights (except at the top-level layout)
