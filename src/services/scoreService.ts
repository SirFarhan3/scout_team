import { supabase } from '@/lib/supabase';

// ==========================================
// INTERFACES & TYPES
// ==========================================

export interface TeamRecord {
  id: string;
  name: string;
  gender: 'Putra' | 'Putri' | 'Campuran' | string | null;
  created_at?: string;
}

export interface ScoreHistoryItem {
  id: string;
  points: number;
  description: string;
  created_at: string;
}

export interface TeamMemberContribution {
  id: string;
  full_name: string;
  class_name: string;
  presentCount: number;
  attendancePoints: number;
}

export interface BestTeamResult {
  id: string;
  name: string;
  gender: 'Putra' | 'Putri' | 'Campuran' | string | null;
  memberCount: number;
  totalAttendanceCount: number;
  attendancePoints: number;
  bonusPoints: number;
  totalScore: number;
  members: TeamMemberContribution[];
  scoreHistory: ScoreHistoryItem[];
}

export interface StudentActiveScoreResult {
  baseScore: number;
  totalBonusPoints: number;
  finalScore: number;
}

export interface BestStudentResult {
  id: string;
  full_name: string;
  class_name: string;
  nta: string | null;
  team_id: string | null;
  group_name: string;
  baseScore: number;
  presentCount: number;
  attendancePoints: number;
  totalBonusPoints: number;
  activeScore: number; // Math.min(100, 80 + totalBonusPoints)
  totalRankingScore: number; // attendancePoints + totalBonusPoints
  bonusHistory: ScoreHistoryItem[];
  attendanceDates: string[];
}

// Helper tanggal lokal YYYY-MM-DD
function toLocalDateKey(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==========================================
// 1. MANAJEMEN REGU (CRUD TEAMS)
// ==========================================

export async function getAllTeams(): Promise<TeamRecord[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, gender, created_at')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Gagal memuat daftar regu: ${error.message}`);
  }
  return (data || []) as TeamRecord[];
}

export async function createTeam(input: {
  name: string;
  gender?: 'Putra' | 'Putri' | 'Campuran' | string | null;
}): Promise<TeamRecord> {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('Nama regu wajib diisi.');
  }

  const { data, error } = await supabase
    .from('teams')
    .insert({
      name: trimmedName,
      gender: input.gender || 'Campuran',
    })
    .select('id, name, gender, created_at')
    .single();

  if (error) {
    throw new Error(`Gagal menambahkan regu: ${error.message}`);
  }
  return data as TeamRecord;
}

export async function updateTeam(
  id: string,
  input: { name?: string; gender?: 'Putra' | 'Putri' | 'Campuran' | string | null }
): Promise<TeamRecord> {
  const payload: any = {};
  if (input.name !== undefined) payload.name = input.name.trim();
  if (input.gender !== undefined) payload.gender = input.gender;

  const { data, error } = await supabase
    .from('teams')
    .update(payload)
    .eq('id', id)
    .select('id, name, gender, created_at')
    .single();

  if (error) {
    throw new Error(`Gagal memperbarui regu: ${error.message}`);
  }
  return data as TeamRecord;
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) {
    throw new Error(`Gagal menghapus regu: ${error.message}`);
  }
}

export async function assignStudentToTeam(
  studentId: string,
  teamId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({ team_id: teamId })
    .eq('id', studentId);

  if (error) {
    throw new Error(`Gagal memindahkan anggota ke regu: ${error.message}`);
  }
}

// ==========================================
// 2. FUNGSI REGU TERBAIK (getBestTeams)
// ==========================================

/**
 * Menghitung total poin setiap regu dengan rumus akumulatif:
 * - Poin Kehadiran: Jumlah absen scan QR anggota regu (status 'Hadir') * 5 poin
 * - Poin Tambahan: Akumulasi points dari tabel team_scores
 * - Skor Akhir Regu = Poin Kehadiran + Poin Tambahan
 * Diurutkan dari skor tertinggi ke terendah.
 */
export async function getBestTeams(): Promise<BestTeamResult[]> {
  const { data: teams, error } = await supabase
    .from('teams')
    .select(`
      id,
      name,
      gender,
      students (
        id,
        full_name,
        class_name,
        attendance (
          id,
          status,
          created_at
        )
      ),
      team_scores (
        id,
        points,
        description,
        created_at
      )
    `);

  if (error) {
    throw new Error(`Gagal memuat data regu terbaik: ${error.message}`);
  }

  if (teams && teams.length > 0) {
    const rankedTeams: BestTeamResult[] = teams.map((team: any) => {
      const studentsList = team.students || [];
      const scoresList = team.team_scores || [];

      let totalAttendanceCount = 0;
      const members: TeamMemberContribution[] = studentsList.map((student: any) => {
        const attendances = student.attendance || [];
        // Hitung hari unik hadir per siswa
        const uniqueDates = new Set<string>();
        for (const a of attendances) {
          if (a.status === 'Hadir') {
            const key = toLocalDateKey(a.created_at) || a.id;
            uniqueDates.add(key);
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

      // Urutkan anggota dari yang paling rajin hadir
      members.sort((a, b) => b.presentCount - a.presentCount);

      const attendancePoints = totalAttendanceCount * 5;

      const scoreHistory: ScoreHistoryItem[] = scoresList
        .map((s: any) => ({
          id: s.id,
          points: Number(s.points) || 0,
          description: s.description || 'Poin Kegiatan / Minigame',
          created_at: s.created_at || new Date().toISOString(),
        }))
        .sort(
          (a: ScoreHistoryItem, b: ScoreHistoryItem) =>
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

    return rankedTeams.sort((a, b) => b.totalScore - a.totalScore);
  }

  // Fallback apabila RLS pada tabel teams belum dibuka
  const { data: studentsFallback } = await supabase
    .from('students')
    .select(`
      id,
      full_name,
      class_name,
      team_id,
      team:teams(id, name, gender),
      attendance (
        id,
        status,
        created_at
      )
    `);

  if (!studentsFallback || studentsFallback.length === 0) {
    return [];
  }

  const teamMap = new Map<string, BestTeamResult>();

  for (const st of studentsFallback as any[]) {
    const teamId = st.team_id || 'unassigned';
    const teamObj = Array.isArray(st.team) ? st.team[0] : st.team;
    const teamName =
      teamObj?.name || (teamId !== 'unassigned' ? 'Pasukan Inti' : 'Tanpa Regu');
    const teamGender = teamObj?.gender || null;

    if (!teamMap.has(teamId)) {
      teamMap.set(teamId, {
        id: teamId,
        name: teamName,
        gender: teamGender,
        memberCount: 0,
        totalAttendanceCount: 0,
        attendancePoints: 0,
        bonusPoints: 0,
        totalScore: 0,
        members: [],
        scoreHistory: [],
      });
    }

    const entry = teamMap.get(teamId)!;
    entry.memberCount += 1;

    const uniqueDates = new Set<string>();
    for (const a of st.attendance || []) {
      if (a.status === 'Hadir') {
        uniqueDates.add(toLocalDateKey(a.created_at) || a.id);
      }
    }
    const presentCount = uniqueDates.size;

    entry.members.push({
      id: st.id,
      full_name: st.full_name || '-',
      class_name: st.class_name || '-',
      presentCount,
      attendancePoints: presentCount * 5,
    });

    entry.totalAttendanceCount += presentCount;
    entry.attendancePoints = entry.totalAttendanceCount * 5;
    entry.totalScore = entry.attendancePoints + entry.bonusPoints;
  }

  return Array.from(teamMap.values()).sort((a, b) => b.totalScore - a.totalScore);
}

// ==========================================
// 3. FUNGSI KEAKTIFAN & PERINGKAT INDIVIDU
// ==========================================

/**
 * Menghitung skor keaktifan individu siswa:
 * - baseScore default = 0
 * - totalBonusPoints = akumulasi points dari student_bonus_points
 * - finalScore = Math.min(100, baseScore + totalBonusPoints)
 */
export async function getStudentActiveScore(
  studentId: string
): Promise<StudentActiveScoreResult> {
  if (!studentId?.trim()) {
    throw new Error('studentId wajib diisi.');
  }

  const baseScore = 0;

  const { data: bonusRecords, error } = await supabase
    .from('student_bonus_points')
    .select('points')
    .eq('student_id', studentId);

  if (error) {
    throw new Error(`Gagal memuat poin keaktifan siswa: ${error.message}`);
  }

  const totalBonusPoints = (bonusRecords || []).reduce(
    (sum, record) => sum + (Number(record.points) || 0),
    0
  );

  const finalScore = Math.min(100, baseScore + totalBonusPoints);

  return {
    baseScore,
    totalBonusPoints,
    finalScore,
  };
}

/**
 * Mengambil peringkat seluruh siswa terbaik beserta detail nilai:
 * - Base Score: 80
 * - Poin Bonus Keaktifan / Minigames (student_bonus_points)
 * - Nilai Keaktifan Akhir: Math.min(100, 80 + totalBonusPoints)
 * - Poin Kehadiran: jumlah hari hadir * 5
 * - Total Skor Peringkat: Poin Kehadiran + Poin Bonus Keaktifan
 */
export async function getBestStudents(): Promise<BestStudentResult[]> {
  const { data: students, error } = await supabase
    .from('students')
    .select(`
      id,
      full_name,
      class_name,
      nta,
      team_id,
      team:teams(id, name),
      attendance (
        id,
        status,
        created_at
      ),
      student_bonus_points (
        id,
        points,
        description,
        created_at
      )
    `)
    .order('full_name', { ascending: true });

  if (error) {
    throw new Error(`Gagal memuat peringkat siswa terbaik: ${error.message}`);
  }

  const baseScore = 0;

  const rankedStudents: BestStudentResult[] = (students || []).map((st: any) => {
    const teamObj = Array.isArray(st.team) ? st.team[0] : st.team;
    const groupName =
      st.group_name || teamObj?.name || (st.team_id ? 'Pasukan Inti' : 'Tanpa Regu');

    // Hitung hari unik hadir
    const uniquePresentDates = new Set<string>();
    for (const att of st.attendance || []) {
      if (att.status === 'Hadir') {
        const key = toLocalDateKey(att.created_at) || att.id;
        uniquePresentDates.add(key);
      }
    }
    const presentCount = uniquePresentDates.size;
    const attendancePoints = presentCount * 5;

    // Riwayat bonus poin
    const bonusHistory: ScoreHistoryItem[] = (st.student_bonus_points || [])
      .map((b: any) => ({
        id: b.id,
        points: Number(b.points) || 0,
        description: b.description || 'Poin Keaktifan / Minigame',
        created_at: b.created_at || new Date().toISOString(),
      }))
      .sort(
        (a: ScoreHistoryItem, b: ScoreHistoryItem) =>
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

  // Urutkan dari totalRankingScore tertinggi -> activeScore -> presentCount -> nama
  return rankedStudents.sort((a, b) => {
    if (b.totalRankingScore !== a.totalRankingScore) {
      return b.totalRankingScore - a.totalRankingScore;
    }
    if (b.activeScore !== a.activeScore) {
      return b.activeScore - a.activeScore;
    }
    if (b.presentCount !== a.presentCount) {
      return b.presentCount - a.presentCount;
    }
    return a.full_name.localeCompare(b.full_name);
  });
}

// ==========================================
// 4. INPUT SKOR MINIGAMES & BONUS KEAKTIFAN
// ==========================================

export async function addTeamScore(input: {
  team_id: string;
  points: number;
  description: string;
}): Promise<ScoreHistoryItem> {
  if (!input.team_id) throw new Error('Pilih regu terlebih dahulu.');
  if (!input.description?.trim()) throw new Error('Deskripsi kegiatan/minigame wajib diisi.');

  const { data, error } = await supabase
    .from('team_scores')
    .insert({
      team_id: input.team_id,
      points: Number(input.points) || 0,
      description: input.description.trim(),
    })
    .select('id, points, description, created_at')
    .single();

  if (error) {
    throw new Error(`Gagal menambahkan skor regu: ${error.message}`);
  }
  return data as ScoreHistoryItem;
}

export async function deleteTeamScore(scoreId: string): Promise<void> {
  const { error } = await supabase.from('team_scores').delete().eq('id', scoreId);
  if (error) {
    throw new Error(`Gagal menghapus riwayat skor regu: ${error.message}`);
  }
}

export async function addStudentBonusPoint(input: {
  student_id: string;
  points: number;
  description: string;
}): Promise<ScoreHistoryItem> {
  if (!input.student_id) throw new Error('Pilih siswa terlebih dahulu.');
  if (!input.description?.trim()) throw new Error('Deskripsi keaktifan/minigame wajib diisi.');

  const { data, error } = await supabase
    .from('student_bonus_points')
    .insert({
      student_id: input.student_id,
      points: Number(input.points) || 0,
      description: input.description.trim(),
    })
    .select('id, points, description, created_at')
    .single();

  if (error) {
    throw new Error(`Gagal menambahkan poin keaktifan siswa: ${error.message}`);
  }
  return data as ScoreHistoryItem;
}

export async function deleteStudentBonusPoint(bonusId: string): Promise<void> {
  const { error } = await supabase
    .from('student_bonus_points')
    .delete()
    .eq('id', bonusId);
  if (error) {
    throw new Error(`Gagal menghapus poin keaktifan siswa: ${error.message}`);
  }
}

export const scoreService = {
  getAllTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  assignStudentToTeam,
  getBestTeams,
  getStudentActiveScore,
  getBestStudents,
  addTeamScore,
  deleteTeamScore,
  addStudentBonusPoint,
  deleteStudentBonusPoint,
};
