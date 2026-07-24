'use client';
import '@ant-design/v5-patch-for-react-19';
import { useEffect, useState } from 'react';
import { Card, Input, Table, Tag, Typography, Space } from 'antd';
import { SearchOutlined, CrownOutlined } from '@ant-design/icons';
import { memberships } from '@/lib/api';

const planColors: Record<string, string> = { free: 'default', plus: 'blue', max: 'purple' };
const planLabels: Record<string, string> = { free: '免费版', plus: '专业版', max: '旗舰版' };

export default function MembershipsPage() {
  const [data, setData] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  async function load(p = 1, s = '') {
    setLoading(true);
    const res = await memberships.list(p, s);
    setData(res.items || []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const columns = [
    { title: '邮箱', dataIndex: 'email', key: 'email', ellipsis: true },
    { title: '状态', dataIndex: 'is_disabled', key: 'status', render: (v: boolean) => v ? <Tag color="error">已禁用</Tag> : <Tag color="success">正常</Tag> },
    { title: '方案', dataIndex: 'plan', key: 'plan', render: (v: string) => <Tag color={planColors[v] || 'default'}>{planLabels[v] || v || '免费'}</Tag> },
    { title: '积分余额', dataIndex: 'credit_balance', key: 'credit', render: (v: number) => Number(v || 0).toFixed(0) },
    { title: '月积分', render: (_: any, r: any) => <span>{r.monthly_credits || 0}</span> },
    { title: '本月已用', render: (_: any, r: any) => <span>{r.credits_used_this_month || 0}</span> },
    { title: '订阅', key: 'sub', render: (_: any, r: any) => r.sub_id ? <><Tag color="green">{r.period === 'yearly' ? '年费' : '月费'}</Tag> <span style={{fontSize:12,color:'#999'}}>{r.sub_started ? new Date(r.sub_started).toLocaleDateString() : ''} - {r.sub_expires ? new Date(r.sub_expires).toLocaleDateString() : ''}</span></> : <Tag>无订阅</Tag> },
    { title: '付费金额', render: (_: any, r: any) => r.sub_amount ? <span>¥{Number(r.sub_amount).toFixed(0)}</span> : '-' },
  ];

  return (
    <>
      <Typography.Title level={3}><CrownOutlined /> 会员管理</Typography.Title>
      <Space style={{ marginBottom: 16 }}>
        <Input prefix={<SearchOutlined />} placeholder="搜索邮箱" value={search} onChange={e => setSearch(e.target.value)} onPressEnter={() => { setPage(1); load(1, search); }} allowClear style={{ width: 260 }} />
      </Space>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ current: page, pageSize: 20, onChange: (p) => { setPage(p); load(p, search); } }} size="middle" />
    </>
  );
}
