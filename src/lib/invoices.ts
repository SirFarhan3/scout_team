import 'server-only';
import crypto from 'crypto';
import { dbAll, dbExec, dbOne, toSqlBool } from '@/lib/turso';
import {
  SUBSCRIPTION_PLANS,
  isPaidPlanCode,
} from '@/lib/subscription-plans';
import {
  AI_TOPUP_PACKAGES,
  PAYMENT_CONFIG,
  isAiTopupPackageCode,
} from '@/lib/payment-config';
import { topupAiCredits } from '@/lib/aiCredits';
import { ValidationError } from '@/lib/authServer';
import type { InvoiceDTO, InvoiceItemType, InvoiceStatus } from '@/types/school';

export function toInvoiceDTO(row: Record<string, unknown>): InvoiceDTO {
  return {
    id: String(row.id),
    invoice_number: String(row.invoice_number),
    school_id: String(row.school_id),
    school_name: String(row.school_name || '-'),
    gugusdepan: row.gugusdepan ? String(row.gugusdepan) : null,
    contact_name: row.contact_name ? String(row.contact_name) : null,
    contact_email: row.contact_email ? String(row.contact_email) : null,
    item_type: (row.item_type === 'topup' ? 'topup' : 'subscription') as InvoiceItemType,
    item_code: String(row.item_code || ''),
    item_name: String(row.item_name || ''),
    item_description: row.item_description ? String(row.item_description) : null,
    period_start: row.period_start ? String(row.period_start) : null,
    period_end: row.period_end ? String(row.period_end) : null,
    amount: Math.max(0, Number(row.amount) || 0),
    discount: Math.max(0, Number(row.discount) || 0),
    total_amount: Math.max(0, Number(row.total_amount) || 0),
    payment_method: String(row.payment_method || PAYMENT_CONFIG.defaultPaymentMethod),
    status: (row.status === 'paid' || row.status === 'cancelled'
      ? row.status
      : 'pending') as InvoiceStatus,
    paid_at: row.paid_at ? String(row.paid_at) : null,
    created_at: String(row.created_at || new Date().toISOString()),
  };
}

/**
 * Menghasilkan nomor invoice berformat `INV/YYYY/MM/XXXX` (auto-increment per bulan).
 */
export async function generateInvoiceNumber(now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `INV/${year}/${month}/`;

  const latest = await dbOne<{ invoice_number: string }>(
    `SELECT invoice_number
     FROM invoices
     WHERE invoice_number LIKE ?
     ORDER BY invoice_number DESC
     LIMIT 1`,
    [`${prefix}%`]
  );

  let nextSeq = 1;
  if (latest?.invoice_number) {
    const parts = String(latest.invoice_number).split('/');
    const lastDigits = parseInt(parts[3] || '0', 10);
    if (!Number.isNaN(lastDigits) && lastDigits >= 1) {
      nextSeq = lastDigits + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Membuat tagihan invoice `pending` baru dengan snapshot data sekolah & harga resmi dari server.
 */
export async function createPendingInvoice(
  schoolId: string,
  itemType: unknown,
  itemCode: unknown
): Promise<InvoiceDTO> {
  if (itemType !== 'subscription' && itemType !== 'topup') {
    throw new ValidationError('Tipe item invoice tidak valid.');
  }

  const schoolRow = await dbOne<Record<string, unknown>>(
    `SELECT * FROM schools WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [schoolId]
  );

  if (!schoolRow) {
    throw new ValidationError('Sekolah tidak ditemukan.');
  }

  let itemName = '';
  let itemDescription = '';
  let amount = 0;
  const discount = 0;
  let validItemCode = '';

  if (itemType === 'subscription') {
    if (!isPaidPlanCode(itemCode)) {
      throw new ValidationError('Kode paket langganan tidak valid (pilih basic atau pro).');
    }
    const plan = SUBSCRIPTION_PLANS[itemCode];
    validItemCode = plan.code;
    itemName = `Langganan ${plan.name}`;
    itemDescription = `Durasi aktif ${plan.durationDays} hari • Maks. ${plan.maxStudents} peserta • Maks. ${plan.maxUsers} admin/pembina • Kuota AI ${plan.aiPlanCredits}x generate`;
    amount = plan.price;
  } else {
    if (!isAiTopupPackageCode(itemCode)) {
      throw new ValidationError('Kode paket Top-Up Token AI tidak valid.');
    }
    const pkg = AI_TOPUP_PACKAGES[itemCode];
    validItemCode = pkg.code;
    itemName = pkg.name;
    itemDescription = pkg.description;
    amount = pkg.price;
  }

  const totalAmount = Math.max(0, amount - discount);
  const now = new Date();
  const nowIso = now.toISOString();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const invoiceNumber =
      attempt === 0
        ? await generateInvoiceNumber(now)
        : `${await generateInvoiceNumber(now)}-${crypto.randomBytes(1).toString('hex').toUpperCase()}`;

    try {
      const id = crypto.randomUUID();
      const created = await dbOne<Record<string, unknown>>(
        `INSERT INTO invoices (
           id, invoice_number, school_id, school_name, gugusdepan, contact_name, contact_email,
           item_type, item_code, item_name, item_description,
           period_start, period_end, amount, discount, total_amount,
           payment_method, status, paid_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, 'pending', NULL, ?)
         RETURNING *`,
        [
          id,
          invoiceNumber,
          schoolId,
          String(schoolRow.name),
          schoolRow.gugusdepan ? String(schoolRow.gugusdepan) : null,
          schoolRow.contact_name ? String(schoolRow.contact_name) : null,
          schoolRow.contact_email ? String(schoolRow.contact_email) : null,
          itemType,
          validItemCode,
          itemName,
          itemDescription,
          amount,
          discount,
          totalAmount,
          PAYMENT_CONFIG.defaultPaymentMethod,
          nowIso,
        ]
      );

      if (created) {
        return toInvoiceDTO(created);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < 3 && msg.toLowerCase().includes('unique')) {
        continue;
      }
      throw err;
    }
  }

  throw new Error('Gagal membuat nomor invoice baru.');
}

/**
 * Mengubah status invoice menjadi `paid`, mengisi `paid_at`, `period_start`, `period_end`,
 * serta otomatis mengaktifkan paket langganan atau menambah saldo `ai_topup_credits` sekolah.
 */
export async function markInvoiceAsPaid(
  invoiceId: string,
  adminUserId: string
): Promise<InvoiceDTO> {
  const existing = await dbOne<Record<string, unknown>>(
    `SELECT * FROM invoices WHERE id = ? LIMIT 1`,
    [invoiceId]
  );

  if (!existing) {
    throw new ValidationError('Invoice tidak ditemukan.');
  }
  if (existing.status === 'paid') {
    throw new ValidationError('Invoice ini sudah berstatus LUNAS.');
  }
  if (existing.status !== 'pending') {
    throw new ValidationError('Hanya invoice berstatus pending yang dapat dikonfirmasi lunas.');
  }

  const schoolId = String(existing.school_id);
  const schoolRow = await dbOne<Record<string, unknown>>(
    `SELECT * FROM schools WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [schoolId]
  );

  if (!schoolRow) {
    throw new ValidationError('Sekolah terkait invoice ini tidak ditemukan.');
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const itemType = String(existing.item_type);
  const itemCode = String(existing.item_code);

  if (itemType === 'subscription') {
    if (!isPaidPlanCode(itemCode)) {
      throw new ValidationError('Kode paket langganan pada invoice tidak valid.');
    }
    const planDef = SUBSCRIPTION_PLANS[itemCode];
    const nowMs = now.getTime();
    const curExpiresMs = new Date(String(schoolRow.subscription_expires_at || '')).getTime();
    const isPaidActive =
      schoolRow.subscription_status === 'active' &&
      !Number.isNaN(curExpiresMs) &&
      curExpiresMs > nowMs;

    const startMs = isPaidActive ? curExpiresMs : nowMs;
    const endMs = startMs + planDef.durationDays * 24 * 60 * 60 * 1000;
    const periodStartIso = new Date(startMs).toISOString();
    const periodEndIso = new Date(endMs).toISOString();

    const claimed = await dbOne<Record<string, unknown>>(
      `UPDATE invoices
       SET status = 'paid', paid_at = ?, period_start = ?, period_end = ?
       WHERE id = ? AND status = 'pending'
       RETURNING *`,
      [nowIso, periodStartIso, periodEndIso, invoiceId]
    );

    if (!claimed) {
      throw new ValidationError('Invoice sedang atau sudah diproses.');
    }

    await dbExec(
      `UPDATE schools
       SET subscription_plan = ?, subscription_status = 'active',
           subscription_started_at = ?, subscription_expires_at = ?,
           max_students = ?, max_users = ?, ai_features_enabled = ?,
           ai_plan_credits = ?, updated_at = ?
       WHERE id = ?`,
      [
        planDef.code,
        nowIso,
        periodEndIso,
        planDef.maxStudents,
        planDef.maxUsers,
        toSqlBool(planDef.aiFeaturesEnabled),
        planDef.aiPlanCredits,
        nowIso,
        schoolId,
      ]
    );

    await dbExec(
      `INSERT INTO ai_credit_logs (id, school_id, user_id, type, source, amount, feature, created_at)
       VALUES (?, ?, ?, 'plan_reset', 'plan', ?, ?, ?)`,
      [
        crypto.randomUUID(),
        schoolId,
        adminUserId,
        planDef.aiPlanCredits,
        `invoice_paid:${existing.invoice_number}`,
        nowIso,
      ]
    );

    return toInvoiceDTO(claimed);
  }

  if (itemType === 'topup') {
    if (!isAiTopupPackageCode(itemCode)) {
      throw new ValidationError('Kode paket Top-Up Token AI pada invoice tidak valid.');
    }
    const pkg = AI_TOPUP_PACKAGES[itemCode];

    const claimed = await dbOne<Record<string, unknown>>(
      `UPDATE invoices
       SET status = 'paid', paid_at = ?
       WHERE id = ? AND status = 'pending'
       RETURNING *`,
      [nowIso, invoiceId]
    );

    if (!claimed) {
      throw new ValidationError('Invoice sedang atau sudah diproses.');
    }

    await topupAiCredits(
      schoolId,
      pkg.tokens,
      adminUserId,
      `invoice_paid:${existing.invoice_number}`
    );

    return toInvoiceDTO(claimed);
  }

  throw new ValidationError('Tipe item invoice tidak dikenali.');
}

/**
 * Membatalkan invoice berstatus `pending`.
 */
export async function cancelPendingInvoice(
  invoiceId: string,
  options: { schoolId?: string; isSuperadmin?: boolean }
): Promise<InvoiceDTO> {
  const existing = await dbOne<Record<string, unknown>>(
    `SELECT * FROM invoices WHERE id = ? LIMIT 1`,
    [invoiceId]
  );

  if (!existing) {
    throw new ValidationError('Invoice tidak ditemukan.');
  }

  if (!options.isSuperadmin && String(existing.school_id) !== options.schoolId) {
    throw new ValidationError('Anda tidak memiliki akses ke invoice ini.');
  }

  if (existing.status !== 'pending') {
    throw new ValidationError('Hanya invoice berstatus pending yang dapat dibatalkan.');
  }

  const updated = await dbOne<Record<string, unknown>>(
    `UPDATE invoices
     SET status = 'cancelled'
     WHERE id = ? AND status = 'pending'
     RETURNING *`,
    [invoiceId]
  );

  if (!updated) {
    throw new ValidationError('Gagal membatalkan invoice.');
  }

  return toInvoiceDTO(updated);
}

export async function getInvoiceById(invoiceId: string): Promise<InvoiceDTO | null> {
  const row = await dbOne<Record<string, unknown>>(
    `SELECT * FROM invoices WHERE id = ? LIMIT 1`,
    [invoiceId]
  );
  return row ? toInvoiceDTO(row) : null;
}

export async function listSchoolInvoices(schoolId: string, limit = 50): Promise<InvoiceDTO[]> {
  const rows = await dbAll<Record<string, unknown>>(
    `SELECT * FROM invoices WHERE school_id = ? ORDER BY created_at DESC LIMIT ?`,
    [schoolId, limit]
  );
  return rows.map(toInvoiceDTO);
}

export async function listAllInvoices(limit = 150): Promise<InvoiceDTO[]> {
  const rows = await dbAll<Record<string, unknown>>(
    `SELECT * FROM invoices ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map(toInvoiceDTO);
}
