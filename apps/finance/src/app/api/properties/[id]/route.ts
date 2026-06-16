import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { withAuth } from '../../../../lib/api/withAuth';

interface UpdateBody {
  name?: string;
  value?: number | string;
  address?: string | null;
  purchasePrice?: number | string | null;
  purchaseDate?: string | null;
  linkedMortgageAccountId?: string | null;
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const PATCH = withAuth<{ id: string }>(
  'properties:update',
  async (request, userId, { params }) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as UpdateBody;

    // Ownership check + grab the backing account id.
    const { data: property, error: loadError } = await supabaseAdmin
      .from('properties')
      .select('id, account_id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (loadError) {
      console.error('[properties:update] load failed', loadError);
      return Response.json({ error: 'Failed to load property' }, { status: 500 });
    }
    if (!property) {
      return Response.json({ error: 'Property not found' }, { status: 404 });
    }

    const nowISO = new Date().toISOString();

    // --- Account row updates (name + value live on the accounts row) ---
    const accountUpdate: { name?: string; balances?: { current: number } } = {};
    if (typeof body.name === 'string' && body.name.trim()) {
      accountUpdate.name = body.name.trim();
    }

    const newValue = toNumberOrNull(body.value);
    const valueChanged = body.value !== undefined;
    if (valueChanged) {
      if (newValue === null || newValue < 0) {
        return Response.json({ error: 'A valid property value is required' }, { status: 400 });
      }
      accountUpdate.balances = { current: newValue };
    }

    if (Object.keys(accountUpdate).length > 0) {
      const { error: accErr } = await supabaseAdmin
        .from('accounts')
        .update(accountUpdate)
        .eq('id', property.account_id)
        .eq('user_id', userId);
      if (accErr) {
        console.error('[properties:update] account update failed', accErr);
        return Response.json({ error: 'Failed to update property' }, { status: 500 });
      }
    }

    // --- Sidecar updates ---
    const propUpdate: {
      address?: string | null;
      purchase_price?: number | null;
      purchase_date?: string | null;
      value_updated_at?: string;
      linked_mortgage_account_id?: string | null;
    } = {};
    if (body.address !== undefined) propUpdate.address = (body.address ?? '').trim() || null;
    if (body.purchasePrice !== undefined) propUpdate.purchase_price = toNumberOrNull(body.purchasePrice);
    if (body.purchaseDate !== undefined) propUpdate.purchase_date = body.purchaseDate || null;
    if (valueChanged) propUpdate.value_updated_at = nowISO;

    // Mortgage (un)linking. Presence of the key means "change it"; a null
    // value means "unlink". Validate ownership for a non-null target.
    if ('linkedMortgageAccountId' in body) {
      const target = body.linkedMortgageAccountId || null;
      if (target) {
        const { data: mortgage } = await supabaseAdmin
          .from('accounts')
          .select('id')
          .eq('id', target)
          .eq('user_id', userId)
          .maybeSingle();
        if (!mortgage) {
          return Response.json({ error: 'Linked mortgage account not found' }, { status: 400 });
        }
      }
      propUpdate.linked_mortgage_account_id = target;
    }

    if (Object.keys(propUpdate).length > 0) {
      const { error: propErr } = await supabaseAdmin
        .from('properties')
        .update(propUpdate)
        .eq('id', id)
        .eq('user_id', userId);
      if (propErr) {
        console.error('[properties:update] sidecar update failed', propErr);
        return Response.json({ error: 'Failed to update property' }, { status: 500 });
      }
    }

    // Record a fresh snapshot whenever the value moves, so the net-worth
    // history series steps to the new value going forward.
    if (valueChanged && newValue !== null) {
      const { error: snapErr } = await supabaseAdmin
        .from('account_snapshots')
        .insert({ account_id: property.account_id, current_balance: newValue, recorded_at: nowISO });
      if (snapErr) {
        console.warn('[properties:update] snapshot insert failed (non-fatal)', snapErr);
      }
    }

    return Response.json({ success: true });
  },
);

export const DELETE = withAuth<{ id: string }>(
  'properties:delete',
  async (_request, userId, { params }) => {
    const { id } = await params;

    const { data: property, error: loadError } = await supabaseAdmin
      .from('properties')
      .select('account_id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (loadError) {
      console.error('[properties:delete] load failed', loadError);
      return Response.json({ error: 'Failed to delete property' }, { status: 500 });
    }
    if (!property) {
      return Response.json({ error: 'Property not found' }, { status: 404 });
    }

    // Deleting the account row cascades to the properties sidecar and its
    // snapshots. The linked mortgage account is left untouched (the FK is
    // ON DELETE SET NULL and lives on the property side anyway).
    const { error: delError } = await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('id', property.account_id)
      .eq('user_id', userId);

    if (delError) {
      console.error('[properties:delete] delete failed', delError);
      return Response.json({ error: 'Failed to delete property' }, { status: 500 });
    }

    return Response.json({ success: true });
  },
);
