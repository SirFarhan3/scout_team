'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, message } from 'antd';
import { Student } from '@/types/student';
import { studentService } from '@/services/studentService';

interface StudentEditModalProps {
  visible: boolean;
  student: Student | null;
  onClose: () => void;
  onUpdate: (updatedStudent: Student) => void;
}

export default function StudentEditModal({
  visible,
  student,
  onClose,
  onUpdate,
}: StudentEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    class_name: '',
    group_name: '',
    nta: '',
  });

  useEffect(() => {
    if (student) {
      setFormData({
        full_name: student.full_name || '',
        class_name: student.class_name || '',
        group_name: student.group_name || '',
        nta: student.nta || '',
      });
    }
  }, [student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    try {
      setLoading(true);
      // Panggil service update ke Supabase (pastikan studentService.updateStudent sudah ada)
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
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nama Lengkap</label>
          <Input
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            placeholder="Masukkan nama lengkap..."
            className="rounded-xl py-2 text-xs font-semibold"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Kelas</label>
            <Input
              value={formData.class_name}
              onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
              placeholder="Contoh: 7A"
              className="rounded-xl py-2 text-xs font-semibold"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Regu</label>
            <Input
              value={formData.group_name}
              onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
              placeholder="Contoh: Elang"
              className="rounded-xl py-2 text-xs font-semibold"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">NTA (Nomor Tanda Anggota)</label>
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