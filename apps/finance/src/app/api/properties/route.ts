import { supabaseAdmin } from '../../../lib/supabase/admin';
import { withAuth } from '../../../lib/api/withAuth';
import { resolveMortgageLink, MortgageLinkError } from '../../../lib/properties/mortgageLink';

// A property is modelled as two rows:
//   1. an `accounts` row (is_manual=true, type 'real estate' / subtype
//      'property') whose balances.current holds the current value. Because
//      it's a normal account row that isn't a liability, net worth counts it
//      as an asset automatically — no special-casing in the net worth math.
//   2. a `properties` sidecar holding purchase info + an optional link to the
//      mortgage liability account backing the home, so the UI can show
//      equity = value - mortgage balance.

interface AccountRef {
  id: string;
  name: string;
  balances: { current?: number | null } | null;
  is_manual?: boolean | null;
}

interface PropertyRow {
  id: string;
  account_id: string;
  address: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  value_source: string;
  value_updated_at: string | null;
  linked_mortgage_account_id: string | null;
  account: AccountRef | null;
  mortgage: AccountRef | null;
}

function balanceOf(ref: AccountRef | null): number {
  return Number(ref?.balances?.current ?? 0);
}

function shapeProperty(row: PropertyRow) {
  const value = balanceOf(row.account);
  const mortgageBalance = row.mortgage ? Math.abs(balanceOf(row.mortgage)) : null;
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.account?.name ?? 'Property',
    address: row.address,
    value,
    purchasePrice: row.purchase_price,
    purchaseDate: row.purchase_date,
    valueSource: row.value_source,
    valueUpdatedAt: row.value_updated_at,
    mortgage: row.mortgage
      ? {
          accountId: row.mortgage.id,
          name: row.mortgage.name,
          balance: mortgageBalance ?? 0,
          manual: Boolean(row.mortgage.is_manual),
        }
      : null,
    equity: mortgageBalance === null ? value : value - mortgageBalance,
  };
}

const PROPERTY_SELECT = `
  id,
  account_id,
  address,
  purchase_price,
  purchase_date,
  value_source,
  value_updated_at,
  linked_mortgage_account_id,
  account:accounts!properties_account_id_fkey ( id, name, balances ),
  mortgage:accounts!properties_linked_mortgage_account_id_fkey ( id, name, balances, is_manual )
`;

export const GET = withAuth('properties:list', async (_request, userId) => {
  const { data, error } = await supabaseAdmin
    .from('properties')
    .select(PROPERTY_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[properties:list] failed', error);
    return Response.json({ error: 'Failed to load properties' }, { status: 500 });
  }

  const properties = ((data ?? []) as unknown as PropertyRow[]).map(shapeProperty);
  return Response.json({ properties });
});

interface CreateBody {
  name?: string;
  value?: number | string;
  address?: string;
  purchasePrice?: number | string | null;
  purchaseDate?: string | null;
  linkedMortgageAccountId?: string | null;
  manualMortgageBalance?: number | string | null;
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const POST = withAuth('properties:create', async (request, userId) => {
  const body = (await request.json().catch(() => ({}))) as CreateBody;

  const name = (body.name ?? '').trim();
  const value = toNumberOrNull(body.value);

  if (!name) {
    return Response.json({ error: 'A property name is required' }, { status: 400 });
  }
  if (value === null || value < 0) {
    return Response.json({ error: 'A valid property value is required' }, { status: 400 });
  }

  // Reconcile the mortgage link (may create a manual liability account).
  let mortgage;
  try {
    mortgage = await resolveMortgageLink({
      userId,
      propertyName: name,
      currentLinkedAccountId: null,
      linkedMortgageAccountId: body.linkedMortgageAccountId || null,
      manualMortgageBalance: toNumberOrNull(body.manualMortgageBalance),
    });
  } catch (err) {
    if (err instanceof MortgageLinkError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const nowISO = new Date().toISOString();

  const cleanupMortgage = async () => {
    if (mortgage.createdAccountId) {
      await supabaseAdmin
        .from('accounts')
        .delete()
        .eq('id', mortgage.createdAccountId)
        .eq('user_id', userId);
    }
  };

  // 1. The asset account row.
  const { data: account, error: accountError } = await supabaseAdmin
    .from('accounts')
    .insert({
      user_id: userId,
      name,
      type: 'real estate',
      subtype: 'property',
      balances: { current: value },
      is_manual: true,
      auto_sync: false,
    })
    .select('id')
    .single();

  if (accountError || !account) {
    console.error('[properties:create] account insert failed', accountError);
    await cleanupMortgage();
    return Response.json({ error: 'Failed to create property' }, { status: 500 });
  }

  // 2. The sidecar. If this fails, roll back the orphaned account rows.
  const { data: property, error: propertyError } = await supabaseAdmin
    .from('properties')
    .insert({
      account_id: account.id,
      user_id: userId,
      address: (body.address ?? '').trim() || null,
      purchase_price: toNumberOrNull(body.purchasePrice),
      purchase_date: body.purchaseDate || null,
      linked_mortgage_account_id: mortgage.linkedId,
      value_updated_at: nowISO,
    })
    .select(PROPERTY_SELECT)
    .single();

  if (propertyError || !property) {
    console.error('[properties:create] property insert failed; rolling back account', propertyError);
    await supabaseAdmin.from('accounts').delete().eq('id', account.id).eq('user_id', userId);
    await cleanupMortgage();
    return Response.json({ error: 'Failed to create property' }, { status: 500 });
  }

  // 3. Seed a balance snapshot so the net-worth history series has a point
  //    for this asset from today forward. Best-effort — never fail the
  //    request over a missing snapshot.
  const { error: snapshotError } = await supabaseAdmin
    .from('account_snapshots')
    .insert({ account_id: account.id, current_balance: value, recorded_at: nowISO });
  if (snapshotError) {
    console.warn('[properties:create] snapshot insert failed (non-fatal)', snapshotError);
  }

  return Response.json({ property: shapeProperty(property as unknown as PropertyRow) }, { status: 201 });
});
