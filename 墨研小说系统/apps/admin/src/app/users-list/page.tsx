'use client';
import '@ant-design/v5-patch-for-react-19';
import { Input, Table, Tag, Typography, Space } from 'antd';
import { TeamOutlined, SearchOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/api';

const API = 'http://localhost:3100/api';
async function f(p: string) { const t = getToken(); return fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()); }

export default function UsersListPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  async function load(s = '') {
    setLoading(true);
    const d = await f(`/admin/users?page=1&search=${encodeURIComponent(s)}`);
    setUsers(d);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const columns = [
    { title: '邮箱', dataIndex: 'email', ellipsis: true },
    { title: '姓名', dataIndex: 'display_name' },
    { title: '角色', dataIndex: 'role', width: 70, render: (v: string) => <Tag color={v==='admin'?'purple':v==='writer'?'green':v==='operator'?'blue':'default'}>{v==='admin'?'管理员':v==='writer'?'编剧':v==='operator'?'运营':v||'用户'}</Tag> },
    { title: '微信', dataIndex: 'wechat_openid', render: (v: string) => v ? <Tag color="green">已绑定</Tag> : <Tag>未绑定</Tag> },
    { title: '会员', dataIndex: 'plan', render: (v: string) => <Tag color={v === 'max' ? 'purple' : v === 'plus' ? 'blue' : 'default'}>{v || 'free'}</Tag> },
    { title: '积分余额', dataIndex: 'credits', render: (v: any) => Number(v || 0).toFixed(0) },
    { title: '累计消耗', dataIndex: 'used_credits', render: (v: any) => Number(v || 0).toFixed(0) },
    { title: '月配额', render: (_: any, r: any) => `${r.monthly_credits || 0} / ${r.credits_used_this_month || 0} 已用` },
    { title: '会员有效期', render: (_: any, r: any) => r.member_expires ? <span style={{fontSize:12}}>{r.member_start ? new Date(r.member_start).toLocaleDateString() + ' - ' : ''}{new Date(r.member_expires).toLocaleDateString()}</span> : '-' },
    { title: '注册', dataIndex: 'created_at', render: (v: string) => new Date(v).toLocaleDateString(), width: 100 },
  ];

  return <>
    <Typography.Title level={3}><TeamOutlined /> 用户管理</Typography.Title>
    <Space style={{ marginBottom: 16 }}>
      <Input prefix={<SearchOutlined />} placeholder="搜索邮箱" value={search} onChange={e => setSearch(e.target.value)} onPressEnter={() => load(search)} allowClear style={{ width: 260 }} />
    </Space>
    <Table rowKey="id" columns={columns} dataSource={users} loading={loading} pagination={{ pageSize: 20 }} size="middle" />
  </>;
}
