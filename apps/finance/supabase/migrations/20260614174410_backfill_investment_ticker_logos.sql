-- Backfill company/fund logos for equities & funds referenced by investment
-- transactions but missing from `tickers` (or present with no logo). Holdings
-- sync only populates tickers the user currently holds, so sold-out positions
-- had no logo and fell back to the generic glyph in the feed.
--
-- Uses logo.dev's ticker endpoint (https://img.logo.dev/ticker/SYMBOL), which
-- resolves by symbol and covers ETFs/money-market funds that the domain-based
-- path missed. Each symbol below was verified to resolve (HTTP 200 with
-- fallback=404); cash-sweep pseudo-tickers (MSPBNA, CUR:USD) 404 and are
-- intentionally omitted. The pk_ token is publishable (already embedded in
-- every browser-served logo URL).
insert into public.tickers (symbol, name, sector, logo, asset_type) values
  ('COP',   'ConocoPhillips',                     null, 'https://img.logo.dev/ticker/COP?token=pk_HwKmdeIeQ-Oft0kXfMWYEg',   'stock'),
  ('TEM',   'Tempus AI',                          null, 'https://img.logo.dev/ticker/TEM?token=pk_HwKmdeIeQ-Oft0kXfMWYEg',   'stock'),
  ('VST',   'Vistra Corp',                        null, 'https://img.logo.dev/ticker/VST?token=pk_HwKmdeIeQ-Oft0kXfMWYEg',   'stock'),
  ('VOO',   'Vanguard S&P 500 ETF',               null, 'https://img.logo.dev/ticker/VOO?token=pk_HwKmdeIeQ-Oft0kXfMWYEg',   'stock'),
  ('VTI',   'Vanguard Total Stock Market ETF',    null, 'https://img.logo.dev/ticker/VTI?token=pk_HwKmdeIeQ-Oft0kXfMWYEg',   'stock'),
  ('VMFXX', 'Vanguard Federal Money Market Fund', null, 'https://img.logo.dev/ticker/VMFXX?token=pk_HwKmdeIeQ-Oft0kXfMWYEg', 'cash')
on conflict (symbol) do update set logo = excluded.logo;
