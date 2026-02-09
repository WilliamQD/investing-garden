import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { deleteHolding, updateHolding } from '@/lib/portfolio';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizeLabel } from '@/lib/validation';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const rateLimit = await checkRateLimit('portfolio:holdings:delete', {
      limit: 40,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many holding updates. Try again shortly.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter ?? 60),
          },
        }
      );
    }
    const session = await getAuthorizedSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.canWrite) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const success = await deleteHolding(id);
    if (!success) {
      return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
    }
    await logAuditEvent('portfolio_holding_removed', session, { holdingId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting holding:', error);
    return NextResponse.json({ error: 'Failed to delete holding' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const rateLimit = await checkRateLimit('portfolio:holdings:update', {
      limit: 60,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many holding updates. Try again shortly.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter ?? 60),
          },
        }
      );
    }
    const session = await getAuthorizedSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.canWrite) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    if (!body || Array.isArray(body) || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    const labelInput = payload.label;
    if (labelInput != null && typeof labelInput !== 'string') {
      return NextResponse.json({ error: 'Label must be a string.' }, { status: 400 });
    }
    const label = labelInput == null ? null : normalizeLabel(labelInput) ?? null;
    const parseOptionalNumber = (
      value: unknown,
      fieldName: string
    ): { value: number | null; error?: string } => {
      if (value == null || value === '') {
        return { value: null };
      }
      const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value));
      if (!Number.isFinite(numeric) || numeric < 0) {
        return { value: null, error: `${fieldName} must be a non-negative number.` };
      }
      return { value: numeric };
    };
    const quantityResult = parseOptionalNumber(payload.quantity, 'Quantity');
    if (quantityResult.error) {
      return NextResponse.json({ error: quantityResult.error }, { status: 400 });
    }
    const purchaseResult = parseOptionalNumber(payload.purchasePrice, 'Purchase price');
    if (purchaseResult.error) {
      return NextResponse.json({ error: purchaseResult.error }, { status: 400 });
    }
    const updated = await updateHolding(id, {
      label,
      quantity: quantityResult.value,
      purchasePrice: purchaseResult.value,
    });
    if (!updated) {
      return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
    }
    await logAuditEvent('portfolio_holding_updated', session, {
      holdingId: updated.id,
      label: updated.label ?? null,
      quantity: updated.quantity ?? null,
      purchasePrice: updated.purchasePrice ?? null,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating holding:', error);
    return NextResponse.json({ error: 'Failed to update holding' }, { status: 500 });
  }
}
