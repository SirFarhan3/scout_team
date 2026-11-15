'use client';

import React from 'react';
import { Table, Button, Space, Popconfirm, Tag } from 'antd';
import { EyeOutlined, EditOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { ProkerItem } from '@/types/program-kerja';

interface ProkerTableProps {
  prokers: ProkerItem[];
  loading: boolean;
  onView: (record: ProkerItem) => void;
  onEdit: (record: ProkerItem) => void;
  onDownload: (record: ProkerItem) => void;
  onDelete: (id: string) => void;
}

export default function ProkerTable({ prokers, loading, onView, onEdit, onDownload, onDelete }: ProkerTableProps) {
  const columns = [
    {
      title: 'No',
      key: 'no',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: ProkerItem, index: number) => (
        <span className="font-semibold text-slate-600 text-xs">{index + 1}</span>
      ),
    },
    {
      title: 'Tahun Ajaran',
      dataIndex: 'tahun_ajaran',
      key: 'tahun_ajaran',
      width: 140,
      render: (text: string) => <span className="font-bold text-indigo-600 text-xs">{text}</span>,
    },
    {
      title: 'Golongan',
      key: 'golongan',
      width: 160,
      render: (_: any, record: ProkerItem) => (
        <div>
          <Tag 
            color={
              record.golongan.toLowerCase() === 'pandega' 
                ? 'brown' 
                : record.golongan.toLowerCase() === 'penegak' 
                ? 'yellow' 
                : record.golongan.toLowerCase() === 'penggalang' 
                ? 'red' 
                : 'green' // (catatan: 'gren' typo jadi 'green')
            }
            className="rounded-md text-[10px] font-semibold mb-1"
          >
            {record.golongan}
          </Tag>
        </div>
      ),
    },{
      title: 'Pangkalan',
      key: 'pangkalan',
      render: (_: any, record: ProkerItem) => (
        <div>
          <div className="text-slate-800 font-medium text-xs">{record.nama_pangkalan}</div>
        </div>
      ),
    },
    {
      title: 'Jumlah Pertemuan',
      key: 'jumlah_pekan',
      width: 160,
      align: 'center' as const,
      render: (_: any, record: ProkerItem) => {
        const kegiatan = Array.isArray(record.kegiatan) ? record.kegiatan : [];
        
        // Mengambil daftar pekan unik (misal: "Pekan 1", "Pekan 2", dst) menggunakan Set
        const uniquePekan = new Set(kegiatan.map((item: any) => item.pekan_ke));
        const totalPekan = uniquePekan.size;

        return (
          <span className="text-slate-700 text-xs font-bold bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
            {totalPekan} Pekan
          </span>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'aksi',
      width: 180,
      align: 'center' as const,
      render: (_: any, record: ProkerItem) => (
        <Space size="small">
          <Button 
            type="text" 
            size="small" 
            icon={<EyeOutlined />} 
            onClick={() => onView(record)} 
            className="text-indigo-600 hover:bg-indigo-50 rounded-lg"
            title="Preview"
          />
          <Button 
            type="text" 
            size="small" 
            icon={<EditOutlined />} 
            onClick={() => onEdit(record)} 
            className="text-amber-600 hover:bg-amber-50 rounded-lg"
            title="Edit"
          />
          <Button 
            type="text" 
            size="small" 
            icon={<DownloadOutlined />} 
            onClick={() => onDownload(record)} 
            className="text-emerald-600 hover:bg-emerald-50 rounded-lg"
            title="Cetak / PDF"
          />
          <Popconfirm
            title="Hapus Program Kerja?"
            description="Data yang dihapus tidak dapat dikembalikan."
            onConfirm={() => onDelete(record.id)}
            okText="Ya"
            cancelText="Batal"
            okButtonProps={{ className: 'bg-rose-600' }}
          >
            <Button 
              type="text" 
              size="small" 
              icon={<DeleteOutlined />} 
              className="text-rose-600 hover:bg-rose-50 rounded-lg"
              title="Hapus"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-none bg-white">
      <Table 
        dataSource={prokers} 
        columns={columns} 
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, size: 'small', showTotal: (total) => `Total ${total} program kerja` }}
        size="middle"
        scroll={{ x: 700 }}
      />
    </div>
  );
}
