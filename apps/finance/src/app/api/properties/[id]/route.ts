import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { withAuth } from '../../../../lib/api/withAuth';
import { resolveMortgageLink, MortgageLinkError } from '../../../../lib/properties/mortgageLink';

interface UpdateBody {
  name?: string;
  value?: number | string;
  address?: string | null;
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

export const PATCH = withAuth<{ id: string }>(
  'properties:update',
  async (request, userId, { params }) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as UpdateBody;

    // Ownership check + grab the backing account id and current mortgage link.
    const { data: property, error: loadError } = await supabaseAdmin
      .from('properties')
      .select('id, account_id, linked_mortgage_account_id')
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
    const propertyName =
      typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Property';

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

    // Mortgage handling. The form always sends both fields, so the presence of
    // either means "reconcile the mortgage": link an account, set a manual
    // balance (mirrored into a real liability account), or clear.
    if ('linkedMortgageAccountId' in body || 'manualMortgageBalance' in body) {
      try {
        const result = await resolveMortgageLink({
          userId,
          propertyName,
          currentLinkedAccountId: property.linked_mortgage_account_id ?? null,
          linkedMortgageAccountId: body.linkedMortgageAccountId || null,
          manualMortgageBalance: toNumberOrNull(body.manualMortgageBalance),
        });
        propUpdate.linked_mortgage_account_id = result.linkedId;
      } catch (err) {
        if (err instanceof MortgageLinkError) {
          return Response.json({ error: err.message }, { status: err.status });
        }
        throw err;
      }
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
      .select('account_id, linked_mortgage_account_id, mortgage:accounts!properties_linked_mortgage_account_id_fkey ( is_manual )')
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

    // Deleting the asset account row cascades to the properties sidecar and its
    // snapshots. A linked Plaid mortgage is left untouched (the FK is ON DELETE
    // SET NULL on the property side).
    const { error: delError } = await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('id', property.account_id)
      .eq('user_id', userId);

    if (delError) {
      console.error('[properties:delete] delete failed', delError);
      return Response.json({ error: 'Failed to delete property' }, { status: 500 });
    }

    // If the mortgage was a manual one we created for this property, remove it
    // too so it doesn't linger as an orphan liability.
    const mortgage = (property as { mortgage?: { is_manual?: boolean | null } | null }).mortgage;
    if (property.linked_mortgage_account_id && mortgage?.is_manual) {
      await supabaseAdmin
        .from('accounts')
        .delete()
        .eq('id', property.linked_mortgage_account_id)
        .eq('user_id', userId);
    }

    return Response.json({ success: true });
  },
);
