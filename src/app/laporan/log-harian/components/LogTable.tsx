'use client';

import React from 'react';
import dayjs from 'dayjs';
import { Table, Button, Space, Popconfirm, Tag } from 'antd';
import { EyeOutlined, EditOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';

interface LogTableProps {
  logs: any[];
  loading: boolean;
  onView: (record: any) => void;
  onEdit: (record: any) => void;
  onDownload: (record: any) => void;
  onDelete: (id: string) => void;
}

export default function LogTable({ logs, loading, onView, onEdit, onDownload, onDelete }: LogTableProps) {
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
      title: 'Tanggal Kegiatan',
      dataIndex: 'tanggal',
      key: 'tanggal',
      render: (tanggal: string) => (
        <span className="font-bold text-slate-800 text-xs">
          {tanggal ? dayjs(tanggal).format('DD MMMM YYYY') : '-'}
        </span>
      ),
    },
    {
      title: 'Jumlah Kegiatan',
      key: 'jumlah',
      width: 150,
      align: 'center' as const,
      render: (_: any, record: any) => {
        const count = Array.isArray(record.kegiatan) ? record.kegiatan.length : 0;
        return (
          <Tag color="geekblue" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold border-none bg-indigo-50 text-indigo-600">
            {count} Kegiatan
          </Tag>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'aksi',
      width: 180,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onView(record)}
            className="text-indigo-600 hover:bg-indigo-50 rounded-lg"
            title="Lihat / Preview"
          />
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
            className="text-amber-600 hover:bg-amber-50 rounded-lg"
            title="Edit Log"
          />
          <Button
            type="text"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => onDownload(record)}
            className="text-emerald-600 hover:bg-emerald-50 rounded-lg"
            title="Download / Print PDF"
          />
          <Popconfirm
            title="Hapus Log Harian?"
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
              title="Hapus Log"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
      <Table
        dataSource={logs}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, size: 'small', showTotal: (total) => `Total ${total} log` }}
        size="middle"
        scroll={{ x: 600 }}
      />
    </div>
  );
}
