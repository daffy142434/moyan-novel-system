'use client';
import { Table, Tag, Select, Input, Button, Modal, message, Popconfirm } from 'antd';
import { useEffect, useState } from 'react';
import { users } from '@/lib/api';

export default function UsersPage() {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [editUser, setEditUser] = useState<any>(null);

  async function load() { const d = await users.list(1, search); setData(d); }
  useEffect(() => { load(); }, [search]);

  async function updateUser(id: string, values: any) {
    await users.update(id, values);
    message.success('已更新'); load();
  }

  const columns = [
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '订阅', dataIndex: 'plan', key: 'plan', render: (v: string) => <Tag color={v === 'max' ? 'gold' : v === 'plus' ? 'blue' : 'default'}>{v || 'free'}</Tag> },
    { title: '积分', dataIndex: 'credit_balance', key: 'credit_balance' },
    { title: '注册时间', dataIndex: 'created_at', key: 'created_at', render: (v: string) => v ? new Date(v).toLocaleDateString('zh-CN') : '-' },
    { title: '状态', dataIndex: 'is_disabled', key: 'is_disabled', render: (v: boolean) => v ? <Tag color="red">已禁用</Tag> : <Tag color="green">正常</Tag> },
    { title: '操作', key: 'actions', render: (_: any, r: any) => (
      <Popconfirm title={`确定${r.is_disabled ? '启用' : '禁用'}该用户？`} onConfirm={() => updateUser(r.id, { is_disabled: !r.is_disabled })}>
        <Button size="small" danger={!r.is_disabled}>{r.is_disabled ? '启用' : '禁用'}</Button>
      </Popconfirm>
    )},
  ];

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>用户管理</h2>
      <Input.Search value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索邮箱..." style={{ width: 300, marginBottom: 16 }} />
      <Table dataSource={data} columns={columns} rowKey="id" pagination={false} />
    </div>
  );
}
