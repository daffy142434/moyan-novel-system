'use client';
import { Button, Table, Upload, Tag, message, Popconfirm } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { skills } from '@/lib/api';

export default function SkillsPage() {
  const [list, setList] = useState<any[]>([]);
  
  async function load() { const d = await skills.list(); setList(d); }
  useEffect(() => { load(); }, []);

  const columns = [
    { title: '技能名', dataIndex: 'name', key: 'name' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'active' ? 'green' : 'default'}>{v || 'active'}</Tag> },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '操作', key: 'actions', render: (_: any, r: any) => (
      <Popconfirm title="确定删除？" onConfirm={async () => { await skills.remove(r.name); load(); message.success('已删除'); }}>
        <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
      </Popconfirm>
    )},
  ];

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>SKILL 管理</h2>
      <Upload accept=".md" showUploadList={false} customRequest={async ({ file, onSuccess }: any) => {
        try { await skills.upload(file); message.success('上传成功'); load(); onSuccess?.(null); } catch { message.error('上传失败'); }
      }}>
        <Button icon={<UploadOutlined />} style={{ marginBottom: 16 }}>上传 SKILL.md</Button>
      </Upload>
      <Table dataSource={list} columns={columns} rowKey="name" pagination={false} />
    </div>
  );
}
