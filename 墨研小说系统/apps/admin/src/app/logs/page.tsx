'use client';
import { Table, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { logs } from '@/lib/api';

export default function LogsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { logs.list().then(d => { setData(d); setLoading(false); }); }, []);

  const columns = [
    { title: '时间', dataIndex: 'created_at', key: 'created_at', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '管理员', dataIndex: 'admin_email', key: 'admin_email' },
    { title: '操作', dataIndex: 'action', key: 'action' },
    { title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true },
  ];

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>操作日志</h2>
      {loading ? <Spin /> : <Table dataSource={data} columns={columns} rowKey="id" pagination={{ pageSize: 20 }} />}
    </div>
  );
}
