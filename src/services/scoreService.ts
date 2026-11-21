import { apiFetch } from '@/lib/apiClient';

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

export interface PointPreset {
  id: string;
  title: string;
  target_type: 'team' | 'student';
  points: number;
  created_at?: string;
}

export interface TeamScoreLogItem {
  id: string;
  team_id: string;
  team_name: string;
  team_gender: string | null;
  points: number;
  description: string;
  created_at: string;
}

export interface StudentBonusLogItem {
  id: string;
  student_id: string;
  student_name: string;
  class_name: string;
  group_name: string;
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
  activeScore: number;
  totalRankingScore: number;
  bonusHistory: ScoreHistoryItem[];
  attendanceDates: string[];
}

export async function getAllTeams(): Promise<TeamRecord[]> {
  const res = await apiFetch<{ success: true; teams: TeamRecord[] }>('/api/teams');
  return res.teams || [];
}

export async function createTeam(input: {
  name: string;
  gender?: 'Putra' | 'Putri' | 'Campuran' | string | null;
}): Promise<TeamRecord> {
  const res = await apiFetch<{ success: true; team: TeamRecord }>('/api/teams', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.team;
}

export async function updateTeam(
  id: string,
  input: { name?: string; gender?: 'Putra' | 'Putri' | 'Campuran' | string | null }
): Promise<TeamRecord> {
  const res = await apiFetch<{ success: true; team: TeamRecord }>(
    `/api/teams/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    }
  );
  return res.team;
}

export async function deleteTeam(id: string): Promise<void> {
  await apiFetch(`/api/teams/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function assignStudentToTeam(
  studentId: string,
  teamId: string | null
): Promise<void> {
  await apiFetch('/api/teams/assign', {
    method: 'POST',
    body: JSON.stringify({ studentId, teamId }),
  });
}

export async function getBestTeams(): Promise<BestTeamResult[]> {
  const res = await apiFetch<{ success: true; teams: BestTeamResult[] }>(
    '/api/scores?view=bestTeams'
  );
  return res.teams || [];
}

export async function getStudentActiveScore(
  studentId: string
): Promise<StudentActiveScoreResult> {
  const res = await apiFetch<{ success: true; result: StudentActiveScoreResult }>(
    `/api/scores?view=studentActive&studentId=${encodeURIComponent(studentId)}`
  );
  return res.result;
}

export async function getBestStudents(): Promise<BestStudentResult[]> {
  const res = await apiFetch<{ success: true; students: BestStudentResult[] }>(
    '/api/scores?view=bestStudents'
  );
  return res.students || [];
}

export async function addTeamScore(input: {
  team_id: string;
  points: number;
  description: string;
}): Promise<ScoreHistoryItem> {
  const res = await apiFetch<{ success: true; item: ScoreHistoryItem }>('/api/scores', {
    method: 'POST',
    body: JSON.stringify({ kind: 'teamScore', ...input }),
  });
  return res.item;
}

export async function updateTeamScore(
  scoreId: string,
  input: { points: number; description: string }
): Promise<ScoreHistoryItem> {
  const res = await apiFetch<{ success: true; item: ScoreHistoryItem }>('/api/scores', {
    method: 'PATCH',
    body: JSON.stringify({ kind: 'teamScore', id: scoreId, ...input }),
  });
  return res.item;
}

export async function deleteTeamScore(scoreId: string): Promise<void> {
  await apiFetch(`/api/scores?kind=teamScore&id=${encodeURIComponent(scoreId)}`, {
    method: 'DELETE',
  });
}

export async function addStudentBonusPoint(input: {
  student_id: string;
  points: number;
  description: string;
}): Promise<ScoreHistoryItem> {
  const res = await apiFetch<{ success: true; item: ScoreHistoryItem }>('/api/scores', {
    method: 'POST',
    body: JSON.stringify({ kind: 'studentBonus', ...input }),
  });
  return res.item;
}

export async function updateStudentBonusPoint(
  bonusId: string,
  input: { points: number; description: string }
): Promise<ScoreHistoryItem> {
  const res = await apiFetch<{ success: true; item: ScoreHistoryItem }>('/api/scores', {
    method: 'PATCH',
    body: JSON.stringify({ kind: 'studentBonus', id: bonusId, ...input }),
  });
  return res.item;
}

export async function deleteStudentBonusPoint(bonusId: string): Promise<void> {
  await apiFetch(`/api/scores?kind=studentBonus&id=${encodeURIComponent(bonusId)}`, {
    method: 'DELETE',
  });
}

export async function getPointPresets(
  targetType?: 'team' | 'student'
): Promise<PointPreset[]> {
  const qs = targetType ? `&targetType=${targetType}` : '';
  const res = await apiFetch<{ success: true; presets: PointPreset[] }>(
    `/api/scores?view=presets${qs}`
  );
  return res.presets || [];
}

export async function createPointPreset(input: {
  title: string;
  target_type: 'team' | 'student';
  points: number;
}): Promise<PointPreset> {
  const res = await apiFetch<{ success: true; item: PointPreset }>('/api/scores', {
    method: 'POST',
    body: JSON.stringify({ kind: 'preset', ...input }),
  });
  return res.item;
}

export async function updatePointPreset(
  id: string,
  input: { title?: string; target_type?: 'team' | 'student'; points?: number }
): Promise<PointPreset> {
  const res = await apiFetch<{ success: true; item: PointPreset }>('/api/scores', {
    method: 'PATCH',
    body: JSON.stringify({ kind: 'preset', id, ...input }),
  });
  return res.item;
}

export async function deletePointPreset(id: string): Promise<void> {
  await apiFetch(`/api/scores?kind=preset&id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getAllTeamScoreLogs(): Promise<TeamScoreLogItem[]> {
  const res = await apiFetch<{ success: true; logs: TeamScoreLogItem[] }>(
    '/api/scores?view=teamLogs'
  );
  return res.logs || [];
}

export async function getAllStudentBonusLogs(): Promise<StudentBonusLogItem[]> {
  const res = await apiFetch<{ success: true; logs: StudentBonusLogItem[] }>(
    '/api/scores?view=studentLogs'
  );
  return res.logs || [];
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
  updateTeamScore,
  deleteTeamScore,
  addStudentBonusPoint,
  updateStudentBonusPoint,
  deleteStudentBonusPoint,
  getPointPresets,
  createPointPreset,
  updatePointPreset,
  deletePointPreset,
  getAllTeamScoreLogs,
  getAllStudentBonusLogs,
};
