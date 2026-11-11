'use client';

import React, { useState } from 'react';
import { Button, Modal, Form, Input, Select, Divider, message, Table, Space } from 'antd';
import { RobotOutlined, SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import ProkerTable from './components/ProkerTable';
import ProkerViewModal from './components/ProkerViewModal';

const { TextArea } = Input;

export default function ProkerTahunanPage() {
  const [form] = Form.useForm();
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  
  // State untuk modal Editable Preview sebelum save
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewMeta, setPreviewMeta] = useState<any>({});
  const [editableActivities, setEditableActivities] = useState<any[]>([]);

  // State untuk modal View/Cetak Arsip Lama
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedViewData, setSelectedViewData] = useState<any>(null);
  
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Contoh data dummy arsip proker
  const [prokers, setProkers] = useState([
    {
      id: '1',
      tahun_ajaran: '2026/2027',
      golongan: 'Penegak',
      nama_pangkalan: 'Gugusdepan 01.001 - 01.002 Ambalan Diponegoro',
      kegiatan: [
        { pekan_ke: 'Pekan 1', durasi: '00.00 - 00.15', keterangan_kegiatan: 'Upacara Pembukaan Latihan' },
        { pekan_ke: 'Pekan 1', durasi: '00.15 - 01.30', keterangan_kegiatan: 'Materi Inti: SKU & Pengenalan Lapangan' },
        { pekan_ke: 'Pekan 1', durasi: '01.30 - 01.45', keterangan_kegiatan: 'Istirahat / Sholat' },
        { pekan_ke: 'Pekan 1', durasi: '01.45 - 02.00', keterangan_kegiatan: 'Upacara Penutupan' },
      ]
    }
  ]);

  // 1. AI Generate diproses, tapi hasilnya dilempar ke Preview Editable dulu
  const handleAiGenerate = async (values: any) => {
    try {
      setGenerating(true);

      const res = await fetch('/api/program-kerja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const rawText = await res.text();
      if (rawText.trim().startsWith('<')) {
        throw new Error("Server mengembalikan halaman HTML (Error 404/500).");
      }

      const data = JSON.parse(rawText);

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Terjadi kesalahan pada server AI.');
      }

      // Simpan metadata dan hasil kegiatan ke state preview editable
      setPreviewMeta({
        tahun_ajaran: values.tahunAjaran,
        golongan: values.golongan,
        nama_pangkalan: values.namaPangkalan,
      });
      setEditableActivities(data.kegiatan);

      // Tutup modal form input, buka modal editable preview
      setIsGeneratorModalOpen(false);
      setIsPreviewModalOpen(true);
      form.resetFields();
      message.success('Program kerja berhasil digenerate! Silakan tinjau dan edit jika perlu.');
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setGenerating(false);
    }
  };

  // 2. Handler untuk mengedit isi sel tabel secara langsung
  const handleCellChange = (index: number, field: string, value: string) => {
    const updated = [...editableActivities];
    updated[index][field] = value;
    setEditableActivities(updated);
  };

  // 3. Tambah baris baru secara manual di preview
  const handleAddRow = () => {
    setEditableActivities([
      ...editableActivities,
      { pekan_ke: 'Pekan Baru', durasi: '00.15 - 00.45', keterangan_kegiatan: 'Tulis kegiatan di sini...' }
    ]);
  };

  // 4. Hapus baris kegiatan
  const handleDeleteRow = (index: number) => {
    const updated = editableActivities.filter((_, i) => i !== index);
    setEditableActivities(updated);
  };

  // 5. Simpan permanen ke list arsip utama setelah diedit
  const handleConfirmSave = () => {
    setSaving(true);
    setTimeout(() => {
      const newProkerItem = {
        id: Date.now().toString(),
        ...previewMeta,
        kegiatan: editableActivities,
      };

      setProkers([newProkerItem, ...prokers]);
      setIsPreviewModalOpen(false);
      setSaving(false);
      message.success('Program Kerja berhasil disimpan ke arsip!');
    }, 500);
  };

  const handleOpenView = (record: any) => {
    setSelectedViewData(record);
    setIsViewModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setProkers(prokers.filter(p => p.id !== id));
    message.success('Program kerja berhasil dihapus.');
  };

  // Kolom untuk tabel editable di modal preview
  const editableColumns = [
    {
      title: 'No',
      key: 'no',
      width: 50,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => <span className="text-xs font-semibold">{index + 1}</span>,
    },
    {
      title: 'Pekan Ke-',
      dataIndex: 'pekan_ke',
      key: 'pekan_ke',
      width: 130,
      render: (text: string, record: any, index: number) => (
        <Input 
          value={text} 
          onChange={(e) => handleCellChange(index, 'pekan_ke', e.target.value)}
          className="text-xs rounded-lg"
        />
      ),
    },
    {
      title: 'Durasi',
      dataIndex: 'durasi',
      key: 'durasi',
      width: 140,
      render: (text: string, record: any, index: number) => (
        <Input 
          value={text} 
          onChange={(e) => handleCellChange(index, 'durasi', e.target.value)}
          className="text-xs rounded-lg font-mono text-indigo-600 font-semibold"
        />
      ),
    },
    {
      title: 'Keterangan Kegiatan',
      dataIndex: 'keterangan_kegiatan',
      key: 'keterangan_kegiatan',
      render: (text: string, record: any, index: number) => (
        <Input 
          value={text} 
          onChange={(e) => handleCellChange(index, 'keterangan_kegiatan', e.target.value)}
          className="text-xs rounded-lg"
        />
      ),
    },
    {
      title: 'Aksi',
      key: 'aksi',
      width: 70,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => (
        <Button 
          type="text" 
          danger 
          size="small"
          icon={<DeleteOutlined />} 
          onClick={() => handleDeleteRow(index)}
        />
      ),
    },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-wide uppercase">PROGRAM KERJA TAHUNAN</h1>
          <p className="text-xs text-slate-500 mt-1">Kelola dan generate program kerja Gugusdepan berbasis kecerdasan buatan.</p>
        </div>
        <Button 
          type="primary" 
          icon={<RobotOutlined />} 
          onClick={() => setIsGeneratorModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 font-bold rounded-2xl h-11 px-6 shadow-sm"
        >
          AI Proker Generator
        </Button>
      </div>

      {/* Tabel Arsip Proker */}
      <ProkerTable 
        prokers={prokers}
        loading={false}
        onView={handleOpenView}
        onEdit={(record) => message.info(`Fitur edit untuk ${record.tahun_ajaran} segera hadir!`)}
        onDownload={handleOpenView}
        onDelete={handleDelete}
      />

      {/* Modal Form Parameter AI Generator */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-base py-2">
            <RobotOutlined className="text-xl" />
            <span>AI Generator Program Kerja Tahunan</span>
          </div>
        }
        open={isGeneratorModalOpen}
        onCancel={() => setIsGeneratorModalOpen(false)}
        footer={null}
        width={750}
        className="rounded-3xl"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            golongan: 'Penegak',
            tahunAjaran: '2026/2027',
            namaPangkalan: 'Gugusdepan 01.001 - 01.002',
            focus: 'Peningkatan tertib administrasi kesekretariatan dan optimalisasi latihan rutin.',
          }}
          onFinish={handleAiGenerate}
          className="space-y-4 pt-2"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              label={<span className="font-semibold text-xs uppercase text-slate-600">Tahun Ajaran / Periode</span>}
              name="tahunAjaran"
              rules={[{ required: true, message: 'Wajib diisi!' }]}
            >
              <Input placeholder="Contoh: 2026/2027" className="rounded-xl" />
            </Form.Item>

            <Form.Item
              label={<span className="font-semibold text-xs uppercase text-slate-600">Golongan Pramuka</span>}
              name="golongan"
              rules={[{ required: true, message: 'Pilih golongan!' }]}
            >
              <Select
                options={[
                  { value: 'Siaga', label: 'Pramuka Siaga' },
                  { value: 'Penggalang', label: 'Pramuka Penggalang' },
                  { value: 'Penegak', label: 'Pramuka Penegak' },
                  { value: 'Pandega', label: 'Pramuka Pandega' },
                ]}
                className="rounded-xl"
              />
            </Form.Item>
          </div>

          <Form.Item
            label={<span className="font-semibold text-xs uppercase text-slate-600">Nama Gugusdepan / Pangkalan</span>}
            name="namaPangkalan"
            rules={[{ required: true, message: 'Nama pangkalan wajib diisi!' }]}
          >
            <Input placeholder="Contoh: Gugusdepan 01.001 - 01.002" className="rounded-xl" />
          </Form.Item>

          <Divider className="my-2" />

          <Form.Item
            label={<span className="font-semibold text-xs uppercase text-slate-600">Fokus Utama Program Kerja</span>}
            name="focus"
            rules={[{ required: true, message: 'Fokus utama wajib diisi!' }]}
          >
            <TextArea 
              rows={3} 
              placeholder="Contoh: Fokus pada tertib arsip log harian, penguatan teknik kepramukaan (pionering), dll." 
              className="rounded-xl"
            />
          </Form.Item>

          <Divider className="my-2" />

          <Form.Item
            label={<span className="font-semibold text-xs uppercase text-slate-600">Catatan / Arahan Tambahan untuk AI</span>}
            name="customPrompt"
          >
            <TextArea 
              rows={2} 
              placeholder="Contoh: Pastikan ada jadwal evaluasi bulanan yang terstruktur." 
              className="rounded-xl"
            />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-3">
            <Button onClick={() => setIsGeneratorModalOpen(false)} className="rounded-xl text-xs">
              Batal
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={generating}
              icon={<RobotOutlined />}
              className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-xs"
            >
              Generate & Review
            </Button>
          </div>
        </Form>
      </Modal>

      {/* MODAL PREVIEW EDITABLE SEBELUM DISIMPAN */}
      <Modal
        title={
          <div className="flex items-center justify-between py-2 pr-6">
            <span className="font-bold text-slate-900 text-base">Pratinjau & Edit Hasil AI Program Kerja</span>
            <Button 
              type="dashed" 
              icon={<PlusOutlined />} 
              onClick={handleAddRow}
              size="small"
              className="rounded-lg text-indigo-600 border-indigo-300"
            >
              Tambah Baris
            </Button>
          </div>
        }
        open={isPreviewModalOpen}
        onCancel={() => setIsPreviewModalOpen(false)}
        footer={[
          <Button key="back" onClick={() => setIsPreviewModalOpen(false)} className="rounded-xl text-xs">
            Batal
          </Button>,
          <Button 
            key="save" 
            type="primary" 
            icon={<SaveOutlined />} 
            loading={saving}
            onClick={handleConfirmSave} 
            className="bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl text-xs"
          >
            Simpan Permanen ke Arsip
          </Button>
        ]}
        width={950}
        className="rounded-3xl"
      >
        <div className="space-y-4 pt-2">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs flex justify-between items-center">
            <div>
              <span className="text-slate-500 font-semibold">Pangkalan:</span> <span className="font-bold text-slate-800">{previewMeta.nama_pangkalan}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold">Tahun Ajaran:</span> <span className="font-bold text-indigo-600">{previewMeta.tahun_ajaran}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 italic">
            * Anda dapat mengedit langsung teks pada kolom tabel di bawah ini (Pekan, Durasi, maupun Keterangan Kegiatan) atau menambah/menghapus baris sebelum menyimpannya ke sistem.
          </p>

          <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm max-h-[55vh] overflow-y-auto">
            <Table 
              dataSource={editableActivities}
              columns={editableColumns}
              rowKey={(_, index) => (index !== undefined ? index.toString() : Math.random().toString())}
              pagination={false}
              size="small"
            />
          </div>
        </div>
      </Modal>

      {/* Modal View & Cetak Resmi Arsip Lama */}
      <ProkerViewModal 
        isOpen={isViewModalOpen}
        viewData={selectedViewData}
        onClose={() => setIsViewModalOpen(false)}
      />
    </div>
  );
}