import 'server-only';
import crypto from 'crypto';
import { dbExec } from '@/lib/turso';

export async function logSecurityEvent(params: {
  schoolId?: string | null;
  userId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await dbExec(
      `INSERT INTO security_audit_logs
         (id, school_id, user_id, action, target_type, target_id, ip_address, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        params.schoolId ?? null,
        params.userId ?? null,
        params.action,
        params.targetType ?? null,
        params.targetId ?? null,
        params.ipAddress ?? null,
        JSON.stringify(params.metadata ?? {}),
        new Date().toISOString(),
      ]
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[AUDIT LOG]', params.action, msg);
  }
}
