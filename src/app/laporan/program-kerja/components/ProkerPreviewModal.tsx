'use client';

import React from 'react';
import { Modal, Button, Table, Input } from 'antd';
import { PlusOutlined, SaveOutlined, DeleteOutlined } from '@ant-design/icons';

interface ProkerPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewMeta: {
    nama_pangkalan?: string;
    golongan?: string;
    tahun_ajaran?: string;
  };
  activities: any[];
  onCellChange: (index: number, field: string, value: string) => void;
  onAddRow: () => void;
  onDeleteRow: (index: number) => void;
  onSave: () => void;
  saving: boolean;
}

export default function ProkerPreviewModal({
  isOpen,
  onClose,
  previewMeta,
  activities,
  onCellChange,
  onAddRow,
  onDeleteRow,
  onSave,
  saving,
}: ProkerPreviewModalProps) {
  const columns = [
    {
      title: 'No',
      key: 'index',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Pekan Ke-',
      dataIndex: 'pekan_ke',
      key: 'pekan_ke',
      width: 110,
      render: (text: string, record: any, index: number) => (
        <Input
          value={text}
          onChange={(e) => onCellChange(index, 'pekan_ke', e.target.value)}
        />
      ),
    },
    {
      title: 'Durasi',
      dataIndex: 'durasi',
      key: 'durasi',
      width: 130,
      render: (text: string, record: any, index: number) => (
        <Input
          value={text}
          onChange={(e) => onCellChange(index, 'durasi', e.target.value)}
        />
      ),
    },
    {
      title: 'Kegiatan',
      dataIndex: 'kegiatan',
      key: 'kegiatan',
      width: 200, // Kolom untuk nama kegiatan inti
      render: (text: string, record: any, index: number) => (
        <Input
          value={text}
          onChange={(e) => onCellChange(index, 'kegiatan', e.target.value)}
        />
      ),
    },
    {
      title: 'Keterangan Kegiatan',
      dataIndex: 'keterangan_kegiatan',
      key: 'keterangan_kegiatan',
      // Kolom untuk deskripsi/keterangan detail
      render: (text: string, record: any, index: number) => (
        <Input
          value={text}
          onChange={(e) => onCellChange(index, 'keterangan_kegiatan', e.target.value)}
        />
      ),
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 70,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => onDeleteRow(index)}
        />
      ),
    },
  ];

  return (
    <Modal
      title={
        <div className="flex items-center justify-between py-2 pr-6">
          <span className="font-bold text-slate-900 text-base">
            Pratinjau & Edit Hasil AI Program Kerja
          </span>
          <Button 
            type="dashed" 
            icon={<PlusOutlined />} 
            onClick={onAddRow}
            size="small"
            className="rounded-lg text-indigo-600 border-indigo-300 font-semibold text-xs"
          >
            Tambah Baris
          </Button>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      footer={[
        <Button key="back" onClick={onClose} className="rounded-xl text-xs h-10 px-4">
          Batal
        </Button>,
        <Button 
          key="save" 
          type="primary" 
          icon={<SaveOutlined />} 
          loading={saving}
          onClick={onSave} 
          className="bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl text-xs h-10 px-5 border-none shadow-md shadow-emerald-100"
        >
          Simpan Permanen ke Arsip
        </Button>
      ]}
      width={950}
      className="rounded-3xl"
    >
      <div className="space-y-4 pt-2">
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs flex justify-between items-center">
          <div>
            <span className="text-slate-500 font-semibold">Pangkalan:</span>{' '}
            <span className="font-bold text-slate-800">{previewMeta.nama_pangkalan || '-'}</span>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <span className="text-slate-500 font-semibold">Golongan:</span>{' '}
              <span className="font-bold text-indigo-600">{previewMeta.golongan || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold">Tahun Ajaran:</span>{' '}
              <span className="font-bold text-indigo-600">{previewMeta.tahun_ajaran || '-'}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500 italic">
          💡 Anda dapat mengedit langsung teks pada kolom tabel di bawah ini (Pekan, Durasi, maupun Keterangan Kegiatan), menambah atau menghapus baris sebelum menyimpannya ke sistem.
        </p>

        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm max-h-[55vh] overflow-y-auto">
          <Table 
            dataSource={activities}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="small"
          />
        </div>
      </div>
    </Modal>
  );
}
