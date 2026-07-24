'use client';

import '@ant-design/v5-patch-for-react-19';
import { CodeOutlined, CopyOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, Input, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../../components/AppShell';
import { session } from '../../../lib/api';

interface PromptLog {
  id: string;
  operation: string;
  model: string;
  skillVersion: string;
  skillPromptLength: number;
  systemPrompt: string;
  userPrompt: string;
  response: string;
  createdAt: string;
}

const operationColor: Record<string, string> = {
  proposal: 'blue', build: 'cyan', episode: 'green',
  episode_review: 'orange', review: 'orange',
  writer_review: 'purple', editor_review_quick: 'red', editor_review_full: 'volcano',
  novel_review: 'gold', outline: 'blue',
};

export default function DebugPromptsPage() {
  const [logs, setLogs] = useState<PromptLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<PromptLog | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!session.hasToken()) return;
    const token = localStorage.getItem('moyan_access_token');
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3100/api'}/studio/debug/prompts?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setLogs)
      .catch(() => messageApi.error('加载失败'))
      .finally(() => setLoading(false));
  }, [messageApi]);

  const filtered = useMemo(
    () => (search ? logs.filter((l) => l.operation.includes(search.toLowerCase()) || l.userPrompt.includes(search)) : logs),
    [logs, search],
  );

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(() => messageApi.success('已复制'));
  }

  const columns = [
    { title: '时间', dataIndex: 'createdAt', width: 150, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: '操作', dataIndex: 'operation', width: 130, render: (v: string) => <Tag color={operationColor[v] ?? 'default'}>{v}</Tag> },
    { title: '模型', dataIndex: 'model', width: 130 },
    { title: 'Skill', dataIndex: 'skillVersion', width: 100, render: (v: string) => v ? <Tag>{v}</Tag> : '-' },
    { title: 'System Prompt', dataIndex: 'systemPrompt', render: (v: string) => <Typography.Text ellipsis style={{ maxWidth: 300 }}>{v.slice(0, 120)}</Typography.Text> },
    { title: '返回结果', dataIndex: 'response', render: (v: string) => v ? <Typography.Text ellipsis style={{ maxWidth: 240 }}>{v.slice(0, 120)}</Typography.Text> : <Typography.Text type="secondary">-</Typography.Text> },
    {
      title: '', width: 50, render: (_: unknown, record: PromptLog) => (
        <Button type="link" size="small" icon={<CodeOutlined />} onClick={() => { setDetail(record); setDetailOpen(true); }} />
      ),
    },
  ];

  return <AppShell>{contextHolder}
    <div className="page-heading"><div><div className="eyebrow">PROMPT DEBUG</div><Typography.Title level={2}>Prompt 调试</Typography.Title><Typography.Text type="secondary">查看每次 AI 调用的完整 System Prompt 和 User Prompt</Typography.Text></div></div>
    <Card size="small" style={{ marginBottom: 16 }}>
      <Input prefix={<SearchOutlined />} placeholder="按操作类型或内容搜索" value={search} onChange={(e) => setSearch(e.target.value)} allowClear style={{ maxWidth: 320 }} />
    </Card>
    <Table rowKey="id" columns={columns} dataSource={filtered} loading={loading} pagination={{ pageSize: 20 }} size="small" />
    <Modal title="Prompt 详情" open={detailOpen} width={900} onCancel={() => setDetailOpen(false)} footer={[
      <Button key="system" icon={<CopyOutlined />} onClick={() => detail && copyText(detail.systemPrompt)}>复制 System Prompt</Button>,
      <Button key="user" icon={<CopyOutlined />} onClick={() => detail && copyText(detail.userPrompt)}>复制 User Prompt</Button>,
      <Button key="response" icon={<CopyOutlined />} onClick={() => detail && copyText(detail.response)}>复制返回结果</Button>,
      <Button key="close" type="primary" onClick={() => setDetailOpen(false)}>关闭</Button>,
    ]}>
      {detail && <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div><Tag color={operationColor[detail.operation]}>{detail.operation}</Tag><Tag>{detail.model}</Tag>{detail.skillVersion && <Tag>{detail.skillVersion}</Tag>}<Typography.Text type="secondary" style={{ marginLeft: 12 }}>{new Date(detail.createdAt).toLocaleString('zh-CN')}</Typography.Text></div>
        <div><Typography.Text strong>System Prompt（{detail.systemPrompt.length.toLocaleString()} 字符）</Typography.Text><Input.TextArea rows={18} readOnly value={detail.systemPrompt} style={{ fontFamily: 'monospace', fontSize: 12 }} /></div>
        <div><Typography.Text strong>User Prompt（{detail.userPrompt.length.toLocaleString()} 字符）</Typography.Text><Input.TextArea rows={6} readOnly value={detail.userPrompt} style={{ fontFamily: 'monospace', fontSize: 12 }} /></div>
        <div><Typography.Text strong>返回结果（{detail.response.length.toLocaleString()} 字符）</Typography.Text><Input.TextArea rows={10} readOnly value={detail.response || '(本次调用暂无返回结果记录)'} style={{ fontFamily: 'monospace', fontSize: 12, background: '#f6ffed' }} /></div>
      </Space>}
    </Modal>
  </AppShell>;
}
