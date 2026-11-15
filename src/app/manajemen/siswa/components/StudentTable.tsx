'use client';

import React from 'react';
import { Table, Tag, Button, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, QrcodeOutlined } from '@ant-design/icons';
import { Student } from '@/types/student';

interface StudentTableProps {
  students: Student[];
  loading: boolean;
  onEdit?: (student: Student) => void;
  onDelete?: (id: string) => void;
  onPrintQR?: (student: Student) => void;
}

export default function StudentTable({ 
  students, 
  loading, 
  onEdit, 
  onDelete, 
  onPrintQR 
}: StudentTableProps) {
  
  const columns = [
    {
      title: 'No',
      key: 'no',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => (
        <span className="font-semibold text-slate-600 text-xs">{index + 1}</span>
      ),
    },
    {
      title: 'QR Code ID',
      dataIndex: 'qr_code_id',
      key: 'qr_code_id',
      width: 150,
      render: (qrCode: string) => (
        <span className="font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-xl text-xs">
          {qrCode || '-'}
        </span>
      ),
    },
    {
      title: 'Nama Lengkap',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (name: string) => (
        <span className="font-semibold text-slate-800 text-xs sm:text-sm">{name}</span>
      ),
    },
    {
      title: 'Kelas',
      dataIndex: 'class_name',
      key: 'class_name',
      width: 100,
      align: 'center' as const,
      render: (className: string) => (
        <Tag color="geekblue" className="rounded-lg font-bold text-xs px-2.5 py-0.5 border-none bg-indigo-100/70 text-indigo-700">
          {className || '-'}
        </Tag>
      ),
    },
    {
      title: 'Regu',
      dataIndex: 'group_name',
      key: 'group_name',
      width: 160,
      render: (groupName: string) => (
        <span className="bg-amber-50 text-amber-700 border border-amber-200/60 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
          ⚜️ {groupName || '-'}
        </span>
      ),
    },
    {
      title: 'NTA',
      dataIndex: 'nta',
      key: 'nta',
      width: 140,
      render: (nta: string) => (
        <span className="text-slate-500 font-mono text-xs">{nta || '-'}</span>
      ),
    },
    {
      title: 'Aksi',
      key: 'aksi',
      width: 130,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, record: Student) => (
        <Space size="small">
          {onPrintQR && (
            <Button
              type="text"
              size="small"
              icon={<QrcodeOutlined />}
              onClick={() => onPrintQR(record)}
              className="text-emerald-600 hover:bg-emerald-50 rounded-xl"
              title="Cetak/Lihat QR"
            />
          )}
          {onEdit && (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
              className="text-amber-600 hover:bg-amber-50 rounded-xl"
              title="Edit Anggota"
            />
          )}
          {onDelete && (
            <Popconfirm
              title="Hapus Anggota?"
              description="Data anggota ini akan dihapus permanen."
              onConfirm={() => onDelete(record.id)}
              okText="Ya, Hapus"
              cancelText="Batal"
              okButtonProps={{ className: 'bg-rose-600 font-bold' }}
            >
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                className="text-rose-600 hover:bg-rose-50 rounded-xl"
                title="Hapus Anggota"
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xl">
            📜
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">Daftar Peserta Didik</h2>
            <p className="text-xs text-slate-400">Total {students.length} anggota terdaftar</p>
          </div>
        </div>

        <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold">
          Active Database
        </span>
      </div>

      <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
        <Table
          dataSource={students}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, size: 'small', showTotal: (total) => `Total ${total} siswa` }}
          size="middle"
          scroll={{ x: 800 }}
        />
      </div>
    </div>
  );
}