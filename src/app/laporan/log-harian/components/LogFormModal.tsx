'use client';

import React from 'react';
import { Modal, Button, DatePicker, TimePicker, Input } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { LogEntry } from '@/types/log-harian';

interface LogFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  selectedDate: string;
  logEntries: LogEntry[];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onDateChange: (date: string) => void;
  onAddRow: () => void;
  onRowChange: (index: number, field: 'waktu' | 'kegiatan', value: string) => void;
  onDeleteRow: (index: number) => void;
}

export default function LogFormModal({
  isOpen,
  mode,
  selectedDate,
  logEntries,
  saving,
  onClose,
  onSave,
  onDateChange,
  onAddRow,
  onRowChange,
  onDeleteRow,
}: LogFormModalProps) {
  return (
    <Modal
      title={<span className="font-bold text-sm">{mode === 'create' ? '➕ Buat Log Harian Baru' : '✏️ Edit Log Harian'}</span>}
      open={isOpen}
      onCancel={onClose}
      footer={[
        <Button key="back" onClick={onClose} className="rounded-xl text-xs">Batal</Button>,
        <Button key="submit" type="primary" loading={saving} onClick={onSave} className="bg-indigo-600 rounded-xl text-xs font-bold">Simpan</Button>
      ]}
      width={700}
      className="rounded-3xl"
    >
      <div className="space-y-4 py-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Tanggal Kegiatan:</label>
          <DatePicker 
            value={dayjs(selectedDate)}
            onChange={(date) => date && onDateChange(date.format('YYYY-MM-DD'))}
            className="w-full rounded-xl h-10 text-xs"
            disabled={mode === 'edit'}
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-slate-500">Daftar Waktu & Kegiatan:</label>
            <Button onClick={onAddRow} size="small" icon={<PlusOutlined />} className="text-xs font-bold rounded-lg">Tambah Baris</Button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {logEntries.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center w-full">
                {/* TimePicker untuk Waktu yang rapi */}
                <div className="w-[140px] shrink-0">
                  <TimePicker 
                    format="HH:mm"
                    placeholder="Pilih Jam"
                    value={item.waktu ? dayjs(item.waktu, 'HH:mm') : null}
                    onChange={(_time, timeString) => {
                      const finalTimeString = typeof timeString === 'string' ? timeString : '';
                      onRowChange(idx, 'waktu', finalTimeString);
                    }}
                    className="rounded-xl text-xs w-full h-9"
                    needConfirm={false}
                  />
                </div>

                {/* Kolom Uraian Kegiatan panjang (flex-1) */}
                <div className="flex-1">
                  <Input 
                    placeholder="Tulis uraian kegiatan di sini..."
                    value={item.kegiatan}
                    onChange={(e) => onRowChange(idx, 'kegiatan', e.target.value)}
                    className="rounded-xl text-xs w-full h-9"
                  />
                </div>

                {/* Tombol Hapus Baris */}
                <div className="shrink-0">
                  <Button 
                    danger 
                    icon={<DeleteOutlined />} 
                    onClick={() => onDeleteRow(idx)}
                    className="rounded-xl flex items-center justify-center h-9 w-9"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}