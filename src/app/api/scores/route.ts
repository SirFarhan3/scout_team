import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { dbAll, dbOne } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertSafeText, assertValidUuid } from '@/lib/sanitize';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';

function toLocalDateKey(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET(request: Request) {
  try {
    const ctx = await requireAuth({
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'bestTeams';

    if (view === 'bestTeams') {
      const [teams, students, attendanceRows, scoreRows] = await Promise.all([
        dbAll<{ id: string; name: string; gender: string | null }>(
          `SELECT id, name, gender FROM teams WHERE school_id = ?`,
          [schoolId]
        ),
        dbAll<{ id: string; full_name: string; class_name: string | null; team_id: string | null }>(
          `SELECT id, full_name, class_name, team_id FROM students WHERE school_id = ?`,
          [schoolId]
        ),
        dbAll<{ id: string; student_id: string; status: string; created_at: string }>(
          `SELECT id, student_id, status, created_at FROM attendance WHERE school_id = ?`,
          [schoolId]
        ),
        dbAll<{ id: string; team_id: string; points: number; description: string; created_at: string }>(
          `SELECT id, team_id, points, description, created_at FROM team_scores WHERE school_id = ?`,
          [schoolId]
        ),
      ]);

      const attendanceByStudent = new Map<
        string,
        Array<{ id: string; status: string; created_at: string }>
      >();
      for (const a of attendanceRows) {
        const sid = String(a.student_id);
        const list = attendanceByStudent.get(sid) || [];
        list.push(a);
        attendanceByStudent.set(sid, list);
      }

      const studentsByTeam = new Map<
        string,
        Array<{ id: string; full_name: string; class_name: string | null }>
      >();
      for (const st of students) {
        if (!st.team_id) continue;
        const tid = String(st.team_id);
        const list = studentsByTeam.get(tid) || [];
        list.push(st);
        studentsByTeam.set(tid, list);
      }

      const scoresByTeam = new Map<
        string,
        Array<{ id: string; points: number; description: string; created_at: string }>
      >();
      for (const sc of scoreRows) {
        const tid = String(sc.team_id);
        const list = scoresByTeam.get(tid) || [];
        list.push(sc);
        scoresByTeam.set(tid, list);
      }

      const rankedTeams = teams.map((team) => {
        const tid = String(team.id);
        const studentsList = studentsByTeam.get(tid) || [];
        const scoresList = scoresByTeam.get(tid) || [];

        let totalAttendanceCount = 0;
        const members = studentsList.map((student) => {
          const uniqueDates = new Set<string>();
          for (const a of attendanceByStudent.get(String(student.id)) || []) {
            if (a.status === 'Hadir') {
              uniqueDates.add(toLocalDateKey(a.created_at) || String(a.id));
            }
          }
          const presentCount = uniqueDates.size;
          totalAttendanceCount += presentCount;

          return {
            id: student.id,
            full_name: student.full_name || '-',
            class_name: student.class_name || '-',
            presentCount,
            attendancePoints: presentCount * 5,
          };
        });

        members.sort((a, b) => b.presentCount - a.presentCount);
        const attendancePoints = totalAttendanceCount * 5;

        const scoreHistory = scoresList
          .map((s) => ({
            id: s.id,
            points: Number(s.points) || 0,
            description: s.description || 'Poin Kegiatan / Minigame',
            created_at: s.created_at || new Date().toISOString(),
          }))
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

        const bonusPoints = scoreHistory.reduce((sum, item) => sum + item.points, 0);
        const totalScore = attendancePoints + bonusPoints;

        return {
          id: team.id,
          name: team.name,
          gender: team.gender || null,
          memberCount: studentsList.length,
          totalAttendanceCount,
          attendancePoints,
          bonusPoints,
          totalScore,
          members,
          scoreHistory,
        };
      });

      rankedTeams.sort((a, b) => b.totalScore - a.totalScore);
      return NextResponse.json({ success: true, teams: rankedTeams });
    }

    if (view === 'bestStudents') {
      const [students, attendanceRows, bonusRows] = await Promise.all([
        dbAll<{
          id: string;
          full_name: string;
          class_name: string | null;
          nta: string | null;
          team_id: string | null;
          team_name: string | null;
        }>(
          `SELECT s.id, s.full_name, s.class_name, s.nta, s.team_id, t.name AS team_name
           FROM students s
           LEFT JOIN teams t ON t.id = s.team_id AND t.school_id = s.school_id
           WHERE s.school_id = ?
           ORDER BY s.full_name COLLATE NOCASE ASC`,
          [schoolId]
        ),
        dbAll<{ id: string; student_id: string; status: string; created_at: string }>(
          `SELECT id, student_id, status, created_at FROM attendance WHERE school_id = ?`,
          [schoolId]
        ),
        dbAll<{ id: string; student_id: string; points: number; description: string; created_at: string }>(
          `SELECT id, student_id, points, description, created_at FROM student_bonus_points WHERE school_id = ?`,
          [schoolId]
        ),
      ]);

      const attendanceByStudent = new Map<
        string,
        Array<{ id: string; status: string; created_at: string }>
      >();
      for (const a of attendanceRows) {
        const sid = String(a.student_id);
        const list = attendanceByStudent.get(sid) || [];
        list.push(a);
        attendanceByStudent.set(sid, list);
      }

      const bonusByStudent = new Map<
        string,
        Array<{ id: string; points: number; description: string; created_at: string }>
      >();
      for (const b of bonusRows) {
        const sid = String(b.student_id);
        const list = bonusByStudent.get(sid) || [];
        list.push(b);
        bonusByStudent.set(sid, list);
      }

      const baseScore = 0;
      const rankedStudents = students.map((st) => {
        const sid = String(st.id);
        const groupName = st.team_name || (st.team_id ? 'Pasukan Inti' : 'Tanpa Regu');

        const uniquePresentDates = new Set<string>();
        for (const att of attendanceByStudent.get(sid) || []) {
          if (att.status === 'Hadir') {
            uniquePresentDates.add(toLocalDateKey(att.created_at) || String(att.id));
          }
        }
        const presentCount = uniquePresentDates.size;
        const attendancePoints = presentCount * 5;

        const bonusHistory = (bonusByStudent.get(sid) || [])
          .map((b) => ({
            id: b.id,
            points: Number(b.points) || 0,
            description: b.description || 'Poin Keaktifan / Minigame',
            created_at: b.created_at || new Date().toISOString(),
          }))
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

        const totalBonusPoints = bonusHistory.reduce((sum, item) => sum + item.points, 0);
        const activeScore = Math.min(100, baseScore + totalBonusPoints);
        const totalRankingScore = attendancePoints + totalBonusPoints;

        return {
          id: st.id,
          full_name: st.full_name || '-',
          class_name: st.class_name || '-',
          nta: st.nta || null,
          team_id: st.team_id || null,
          group_name: groupName,
          baseScore,
          presentCount,
          attendancePoints,
          totalBonusPoints,
          activeScore,
          totalRankingScore,
          bonusHistory,
          attendanceDates: Array.from(uniquePresentDates).sort().reverse(),
        };
      });

      rankedStudents.sort((a, b) => {
        if (b.totalRankingScore !== a.totalRankingScore) {
          return b.totalRankingScore - a.totalRankingScore;
        }
        if (b.activeScore !== a.activeScore) return b.activeScore - a.activeScore;
        if (b.presentCount !== a.presentCount) return b.presentCount - a.presentCount;
        return a.full_name.localeCompare(b.full_name);
      });

      return NextResponse.json({ success: true, students: rankedStudents });
    }

    if (view === 'studentActive') {
      const studentId = assertValidUuid(searchParams.get('studentId'), 'ID Siswa');
      const st = await dbOne<{ id: string }>(
        `SELECT id FROM students WHERE id = ? AND school_id = ? LIMIT 1`,
        [studentId, schoolId]
      );

      if (!st) throw new ValidationError('Siswa tidak ditemukan pada sekolah Anda.');

      const bonusRecords = await dbAll<{ points: number }>(
        `SELECT points FROM student_bonus_points WHERE school_id = ? AND student_id = ?`,
        [schoolId, studentId]
      );

      const baseScore = 0;
      const totalBonusPoints = bonusRecords.reduce(
        (sum, rec) => sum + (Number(rec.points) || 0),
        0
      );
      return NextResponse.json({
        success: true,
        result: {
          baseScore,
          totalBonusPoints,
          finalScore: Math.min(100, baseScore + totalBonusPoints),
        },
      });
    }

    if (view === 'presets') {
      const targetType = searchParams.get('targetType');
      const hasTarget = targetType === 'team' || targetType === 'student';
      const presets = hasTarget
        ? await dbAll<Record<string, unknown>>(
            `SELECT id, title, target_type, points, created_at
             FROM point_presets
             WHERE school_id = ? AND target_type = ?
             ORDER BY points DESC`,
            [schoolId, targetType]
          )
        : await dbAll<Record<string, unknown>>(
            `SELECT id, title, target_type, points, created_at
             FROM point_presets
             WHERE school_id = ?
             ORDER BY points DESC`,
            [schoolId]
          );

      return NextResponse.json({ success: true, presets });
    }

    if (view === 'teamLogs') {
      const rows = await dbAll<Record<string, unknown>>(
        `SELECT ts.id, ts.team_id, ts.points, ts.description, ts.created_at,
                t.name AS team_name, t.gender AS team_gender
         FROM team_scores ts
         LEFT JOIN teams t ON t.id = ts.team_id AND t.school_id = ts.school_id
         WHERE ts.school_id = ?
         ORDER BY ts.created_at DESC`,
        [schoolId]
      );

      const logs = rows.map((row) => ({
        id: row.id,
        team_id: row.team_id,
        team_name: row.team_name ? String(row.team_name) : 'Regu',
        team_gender: row.team_gender ? String(row.team_gender) : null,
        points: Number(row.points) || 0,
        description: row.description ? String(row.description) : '-',
        created_at: row.created_at,
      }));
      return NextResponse.json({ success: true, logs });
    }

    if (view === 'studentLogs') {
      const rows = await dbAll<Record<string, unknown>>(
        `SELECT sb.id, sb.student_id, sb.points, sb.description, sb.created_at,
                s.full_name AS student_name, s.class_name, t.name AS group_name
         FROM student_bonus_points sb
         LEFT JOIN students s ON s.id = sb.student_id AND s.school_id = sb.school_id
         LEFT JOIN teams t ON t.id = s.team_id AND t.school_id = s.school_id
         WHERE sb.school_id = ?
         ORDER BY sb.created_at DESC`,
        [schoolId]
      );

      const logs = rows.map((row) => ({
        id: row.id,
        student_id: row.student_id,
        student_name: row.student_name ? String(row.student_name) : 'Siswa',
        class_name: row.class_name ? String(row.class_name) : '-',
        group_name: row.group_name ? String(row.group_name) : '-',
        points: Number(row.points) || 0,
        description: row.description ? String(row.description) : '-',
        created_at: row.created_at,
      }));
      return NextResponse.json({ success: true, logs });
    }

    throw new ValidationError('Parameter view tidak valid.');
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Payload tidak valid.');
    }

    const kind = body.kind;
    const allowedRoles =
      kind === 'preset' ? (['admin', 'pembina'] as const) : (['admin', 'pembina', 'instruktur'] as const);

    const ctx = await requireAuth({
      roles: allowedRoles,
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;
    const nowIso = new Date().toISOString();

    if (kind === 'teamScore') {
      const teamId = assertValidUuid(body.team_id, 'ID Regu');
      const safeDesc = assertSafeText(body.description, 'Deskripsi Skor Regu', 300);
      if (!safeDesc) throw new ValidationError('Deskripsi kegiatan/minigame wajib diisi.');
      const points = Number(body.points) || 0;

      const team = await dbOne<{ id: string }>(
        `SELECT id FROM teams WHERE id = ? AND school_id = ? LIMIT 1`,
        [teamId, schoolId]
      );

      if (!team) throw new ValidationError('Regu tidak ditemukan pada sekolah Anda.');

      const data = await dbOne<Record<string, unknown>>(
        `INSERT INTO team_scores (id, school_id, team_id, points, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING id, points, description, created_at`,
        [crypto.randomUUID(), schoolId, teamId, points, safeDesc, nowIso]
      );

      return NextResponse.json({ success: true, item: data }, { status: 201 });
    }

    if (kind === 'studentBonus') {
      const studentId = assertValidUuid(body.student_id, 'ID Siswa');
      const safeDesc = assertSafeText(body.description, 'Deskripsi Poin Siswa', 300);
      if (!safeDesc) throw new ValidationError('Deskripsi keaktifan/minigame wajib diisi.');
      const points = Number(body.points) || 0;

      const st = await dbOne<{ id: string }>(
        `SELECT id FROM students WHERE id = ? AND school_id = ? LIMIT 1`,
        [studentId, schoolId]
      );

      if (!st) throw new ValidationError('Siswa tidak ditemukan pada sekolah Anda.');

      const data = await dbOne<Record<string, unknown>>(
        `INSERT INTO student_bonus_points (id, school_id, student_id, points, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING id, points, description, created_at`,
        [crypto.randomUUID(), schoolId, studentId, points, safeDesc, nowIso]
      );

      return NextResponse.json({ success: true, item: data }, { status: 201 });
    }

    if (kind === 'preset') {
      const safeTitle = assertSafeText(body.title, 'Nama Master Poin', 200);
      if (!safeTitle) throw new ValidationError('Nama / deskripsi poin wajib diisi.');
      if (body.target_type !== 'team' && body.target_type !== 'student') {
        throw new ValidationError('Target master poin tidak valid.');
      }
      const points = Number(body.points) || 0;

      const data = await dbOne<Record<string, unknown>>(
        `INSERT INTO point_presets (id, school_id, title, target_type, points, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING id, title, target_type, points, created_at`,
        [crypto.randomUUID(), schoolId, safeTitle, body.target_type, points, nowIso]
      );

      return NextResponse.json({ success: true, item: data }, { status: 201 });
    }

    throw new ValidationError('Jenis transaksi poin tidak valid.');
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({
      roles: ['admin', 'pembina'],
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new ValidationError('Payload tidak valid.');

    const id = assertValidUuid(body.id, 'ID');
    const kind = body.kind;

    if (kind === 'teamScore') {
      const safeDesc = assertSafeText(body.description, 'Deskripsi Skor Regu', 300);
      const data = await dbOne<Record<string, unknown>>(
        `UPDATE team_scores
         SET points = ?, description = ?
         WHERE id = ? AND school_id = ?
         RETURNING id, points, description, created_at`,
        [Number(body.points) || 0, safeDesc, id, schoolId]
      );

      if (!data) throw new ValidationError('Catatan skor regu tidak ditemukan.');
      return NextResponse.json({ success: true, item: data });
    }

    if (kind === 'studentBonus') {
      const safeDesc = assertSafeText(body.description, 'Deskripsi Poin Siswa', 300);
      const data = await dbOne<Record<string, unknown>>(
        `UPDATE student_bonus_points
         SET points = ?, description = ?
         WHERE id = ? AND school_id = ?
         RETURNING id, points, description, created_at`,
        [Number(body.points) || 0, safeDesc, id, schoolId]
      );

      if (!data) throw new ValidationError('Catatan poin siswa tidak ditemukan.');
      return NextResponse.json({ success: true, item: data });
    }

    if (kind === 'preset') {
      const setClauses: string[] = [];
      const args: Array<string | number> = [];

      if (body.title !== undefined) {
        setClauses.push('title = ?');
        args.push(assertSafeText(body.title, 'Nama Master Poin', 200));
      }
      if (body.target_type === 'team' || body.target_type === 'student') {
        setClauses.push('target_type = ?');
        args.push(body.target_type);
      }
      if (body.points !== undefined) {
        setClauses.push('points = ?');
        args.push(Number(body.points) || 0);
      }

      if (setClauses.length === 0) {
        throw new ValidationError('Tidak ada data master poin yang diperbarui.');
      }

      args.push(id, schoolId);

      const data = await dbOne<Record<string, unknown>>(
        `UPDATE point_presets
         SET ${setClauses.join(', ')}
         WHERE id = ? AND school_id = ?
         RETURNING id, title, target_type, points, created_at`,
        args
      );

      if (!data) throw new ValidationError('Master poin tidak ditemukan.');
      return NextResponse.json({ success: true, item: data });
    }

    throw new ValidationError('Jenis pembaruan tidak valid.');
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({
      roles: ['admin', 'pembina'],
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;

    const { searchParams } = new URL(request.url);
    const id = assertValidUuid(searchParams.get('id'), 'ID');
    const kind = searchParams.get('kind');

    const tableMap: Record<string, 'team_scores' | 'student_bonus_points' | 'point_presets'> = {
      teamScore: 'team_scores',
      studentBonus: 'student_bonus_points',
      preset: 'point_presets',
    };
    const table = kind ? tableMap[kind] : null;
    if (!table) throw new ValidationError('Jenis penghapusan tidak valid.');

    const deleted = await dbAll<{ id: string }>(
      `DELETE FROM ${table} WHERE id = ? AND school_id = ? RETURNING id`,
      [id, schoolId]
    );

    if (deleted.length === 0) {
      throw new ValidationError('Data tidak ditemukan pada sekolah Anda.');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
