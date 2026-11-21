import { NextResponse } from 'next/server';
import { dbAll } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertValidUuid } from '@/lib/sanitize';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({
      roles: ['admin', 'pembina'],
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const { id } = await context.params;
    const logId = assertValidUuid(id, 'ID Log');

    const deleted = await dbAll<{ id: string }>(
      `DELETE FROM log_books WHERE id = ? AND school_id = ? RETURNING id`,
      [logId, ctx.school!.id]
    );

    if (deleted.length === 0) {
      throw new ValidationError('Log tidak ditemukan pada sekolah Anda.');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
