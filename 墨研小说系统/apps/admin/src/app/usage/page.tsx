'use client';
import { Table, Card, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { usage } from '@/lib/api';

export default function UsagePage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { usage.byUser().then(d => { setData(d); setLoading(false); }); }, []);

  const columns = [
    { title: '用户', dataIndex: 'email', key: 'email' },
    { title: '调用次数', dataIndex: 'total_calls', key: 'total_calls' },
    { title: '输入 Token', dataIndex: 'total_input_tokens', key: 'total_input_tokens', render: (v: number) => (v || 0).toLocaleString() },
    { title: '输出 Token', dataIndex: 'total_output_tokens', key: 'total_output_tokens', render: (v: number) => (v || 0).toLocaleString() },
    { title: '积分消耗', dataIndex: 'total_credits', key: 'total_credits' },
  ];

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>用量统计（匿名）</h2>
      {loading ? <Spin /> : <Table dataSource={data} columns={columns} rowKey="email" pagination={false} />}
    </div>
  );
}
