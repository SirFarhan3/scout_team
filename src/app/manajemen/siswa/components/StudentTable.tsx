import { Student } from '@/types/student';

interface StudentTableProps {
  students: Student[];
  loading: boolean;
}

export default function StudentTable({ students, loading }: StudentTableProps) {
  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xl">
            📜
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Daftar Peserta Didik</h2>
            <p className="text-xs text-slate-400">Total {students.length} anggota terdaftar</p>
          </div>
        </div>

        <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold">
          Active Database
        </span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 animate-pulse font-medium">
          ⏳ Memuat data siswa dari Supabase...
        </div>
      ) : students.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <p className="text-4xl mb-2">🎈</p>
          <p className="text-slate-600 font-bold text-base">Belum Ada Data Anggota</p>
          <p className="text-slate-400 text-xs mt-1">Gunakan form di atas untuk menambahkan siswa pertama.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="p-4">QR Code ID</th>
                <th className="p-4">Nama Lengkap</th>
                <th className="p-4">Regu</th>
                <th className="p-4">NTA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-mono font-bold text-indigo-600">
                    <span className="bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-xl">
                      {student.qr_code_id}
                    </span>
                  </td>
                  <td className="p-4 font-semibold text-slate-800">{student.full_name}</td>
                  <td className="p-4">
                    <span className="bg-amber-50 text-amber-700 border border-amber-200/60 px-3 py-1 rounded-full text-xs font-bold">
                      ⚜️ {student.group_name}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 font-mono text-xs">{student.nta || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}