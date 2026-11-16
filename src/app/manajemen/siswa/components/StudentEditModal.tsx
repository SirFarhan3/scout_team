'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Input, Button, Radio, message } from 'antd';
import { Student } from '@/types/student';
import { studentService } from '@/services/studentService';
import { getAllTeams, TeamRecord } from '@/services/scoreService';

interface StudentEditModalProps {
  visible: boolean;
  student: Student | null;
  onClose: () => void;
  onUpdate: (updatedStudent: Student) => void;
}

const KELAS_OPTIONS = ['6A', '6B', '5A', '5B'];

export default function StudentEditModal({
  visible,
  student,
  onClose,
  onUpdate,
}: StudentEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [allTeams, setAllTeams] = useState<TeamRecord[]>([]);
  const [gender, setGender] = useState<'Putra' | 'Putri'>('Putra');
  const [formData, setFormData] = useState({
    full_name: '',
    class_name: '6A',
    group_name: '',
    nta: '',
  });

  useEffect(() => {
    if (visible) {
      getAllTeams()
        .then((teams) => {
          setAllTeams(teams || []);
          if (student) {
            const matchedTeam = (teams || []).find(
              (t) => t.name.toLowerCase() === (student.group_name || '').toLowerCase()
            );
            if (matchedTeam && (matchedTeam.gender === 'Putra' || matchedTeam.gender === 'Putri')) {
              setGender(matchedTeam.gender);
            }
          }
        })
        .catch(() => {});
    }
  }, [visible, student]);

  useEffect(() => {
    if (student) {
      setFormData({
        full_name: student.full_name || '',
        class_name: student.class_name || '6A',
        group_name: student.group_name || '',
        nta: student.nta || '',
      });
    }
  }, [student]);

  const filteredTeams = useMemo(() => {
    return allTeams.filter(
      (t) => (t.gender || '').toLowerCase() === gender.toLowerCase()
    );
  }, [allTeams, gender]);

  // Saat radio gender diganti, sesuaikan group_name ke regu pertama yang cocok
  const handleGenderChange = (newGender: 'Putra' | 'Putri') => {
    setGender(newGender);
    const matching = allTeams.filter(
      (t) => (t.gender || '').toLowerCase() === newGender.toLowerCase()
    );
    if (matching.length > 0) {
      setFormData((prev) => ({ ...prev, group_name: matching[0].name }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    try {
      setLoading(true);
      const updated = await studentService.updateStudent(student.id, formData);
      onUpdate(updated);
      message.success('Data anggota berhasil diperbarui!');
      onClose();
    } catch (error: any) {
      message.error(`Gagal memperbarui data: ${error?.message || 'Terjadi kesalahan'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div className="text-base font-bold text-slate-800 pb-2 border-b border-slate-100">
          ✏️ Edit Data Anggota Pramuka
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
      className="rounded-3xl overflow-hidden"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            Nama Lengkap
          </label>
          <Input
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            placeholder="Masukkan nama lengkap..."
            className="rounded-xl py-2 text-xs font-semibold"
            required
          />
        </div>

        {/* Radio Button Putra / Putri */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            Jenis Kelamin / Kategori Regu
          </label>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
            <Radio.Group
              value={gender}
              onChange={(e) => handleGenderChange(e.target.value)}
            >
              <Radio value="Putra" className="text-xs font-semibold">
                👦 Putra
              </Radio>
              <Radio value="Putri" className="text-xs font-semibold">
                👧 Putri
              </Radio>
            </Radio.Group>
            <span className="text-[10px] text-slate-400">
              {filteredTeams.length} Regu {gender}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Kelas
            </label>
            <select
              value={formData.class_name}
              onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {KELAS_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  Kelas {k}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Regu ({gender})
            </label>
            <select
              value={formData.group_name}
              onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {filteredTeams.map((team) => (
                <option key={team.id} value={team.name}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            NTA (Nomor Tanda Anggota)
          </label>
          <Input
            value={formData.nta}
            onChange={(e) => setFormData({ ...formData, nta: e.target.value })}
            placeholder="Nomor Tanda Anggota (opsional)..."
            className="rounded-xl py-2 text-xs font-semibold font-mono"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button
            onClick={onClose}
            className="rounded-xl text-xs font-bold border-slate-200"
          >
            Batal
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100"
          >
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </Modal>
  );
}
