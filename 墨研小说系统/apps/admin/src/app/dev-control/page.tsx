'use client';
import '@ant-design/v5-patch-for-react-19';
import { Button, Card, message, Switch, Typography, Space, Table, Modal, Tag } from 'antd';
import { BugOutlined, ReloadOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/api';

const API = 'http://localhost:3100/api';
async function f(p: string, m = 'GET', b?: any) { const t = getToken(); return fetch(`${API}${p}`, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json()); }

export default function DevControlPage() {
  const [debugOn, setDebugOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    f('/admin/settings').then((s: any) => {
      const on = s.prompt_debug === '"on"' || s.prompt_debug === 'true';
      setDebugOn(on);
      if (on) loadLogs();
      setLoading(false);
    });
  }, []);

  async function loadLogs() {
    const d = await f('/admin/prompt-debug-logs?limit=50');
    setLogs(d || []);
  }

  async function toggle(v: boolean) {
    setDebugOn(v);
    await f('/admin/settings', 'PUT', { prompt_debug: v ? '"on"' : '"off"' });
    message.success(v ? '已开启 Prompt Debug' : '已关闭 Prompt Debug');
    if (v) loadLogs();
    else setLogs([]);
  }

  const columns = [
    { title: '使用人', dataIndex: 'user_email', width: 130, ellipsis: true },
    { title: '操作', dataIndex: 'operation', width: 80, render: (v: string) => <Tag>{v}</Tag> },
    { title: '模型', dataIndex: 'model', width: 120, ellipsis: true },
    { title: '系统提示词', dataIndex: 'full_system_prompt', ellipsis: true, render: (v: string) => (v || '').slice(0, 20) + (v?.length > 20 ? '...' : '') },
    { title: '用户提示词', dataIndex: 'user_prompt', ellipsis: true, width: 150, render: (v: string) => (v || '').slice(0, 20) + (v?.length > 20 ? '...' : '') },
    { title: '响应', dataIndex: 'response', ellipsis: true, width: 150, render: (v: string) => (v || '').slice(0, 20) + (v?.length > 20 ? '...' : '') },
    { title: '时间', dataIndex: 'created_at', width: 140, render: (v: string) => new Date(v).toLocaleString() },
    { title: '操作', width: 60, render: (_: any, r: any) => <Button size="small" onClick={() => setDetail(r)}>详情</Button> },
  ];

  return (
    <div>
      <Typography.Title level={3}><BugOutlined /> 开发控制</Typography.Title>
      <Card loading={loading}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card title="Prompt Debug" size="small">
            <Space>
              <Switch checked={debugOn} onChange={toggle} />
              <Typography.Text type={debugOn ? 'success' : 'secondary'}>
                {debugOn ? '已开启 — 每次 AI 调用将记录完整 prompt 到 model_prompt_debug_logs 表' : '已关闭'}
              </Typography.Text>
              {debugOn && <Button size="small" icon={<ReloadOutlined />} onClick={loadLogs}>刷新</Button>}
            </Space>
          </Card>

          {debugOn && (
            <Card title={`提示词日志 (${logs.length})`} size="small">
              <Table rowKey="id" dataSource={logs} columns={columns} size="small" pagination={{ pageSize: 20 }} scroll={{ x: 800 }} />
            </Card>
          )}
        </Space>
      </Card>

      <Modal title="提示词详情" open={!!detail} onCancel={() => setDetail(null)} footer={null} width={800}>
        {detail && <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div><Typography.Text strong>操作: </Typography.Text><Tag>{detail.operation}</Tag> <Tag>{detail.model}</Tag> <Typography.Text type="secondary">使用人: {detail.user_email}</Typography.Text></div>
          <Card title="Skill 提示词" size="small"><pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12, maxHeight: 200, overflow: 'auto' }}>{detail.skill_prompt}</pre></Card>
          <Card title="用户提示词" size="small"><pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12, maxHeight: 150, overflow: 'auto' }}>{detail.user_prompt}</pre></Card>
          <Card title="完整系统提示词" size="small"><pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12, maxHeight: 300, overflow: 'auto' }}>{detail.full_system_prompt}</pre></Card>
          <Card title="AI 响应" size="small"><pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12, maxHeight: 300, overflow: 'auto' }}>{detail.response}</pre></Card>
        </Space>}
      </Modal>
    </div>
  );
}
