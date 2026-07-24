'use client';
import '@ant-design/v5-patch-for-react-19';
import { Button, Card, message, Select, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/api';

const API = 'http://localhost:3100/api';
async function f(p: string, m = 'GET', b?: any) { const t = getToken(); return fetch(`${API}${p}`, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json()); }

const SCENARIOS = [
  { key: 'proposal', label: '创作方案生成' }, { key: 'outline', label: '故事大纲' },
  { key: 'characters', label: '角色开发' }, { key: 'catalog', label: '目录大纲' },
  { key: 'episode_generate', label: '剧集创作' }, { key: 'episode_optimize', label: '剧集优化' },
  { key: 'episode_review', label: '剧集审核' }, { key: 'novel_review', label: '全篇审核' },
];

export default function WritingModelsPage() {
  const [models, setModels] = useState<any[]>([]);
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    f('/admin/writing-models').then((d: any) => {
      setModels(d.systemModels || []);
      setDefaults(d.defaultModels?.reduce((acc: any, r: any) => { acc[r.key.replace('default_model_', '')] = r.value; return acc; }, {}) || {});
    });
  }, []);

  async function save() {
    setLoading(true);
    await f('/admin/writing-models', 'PUT', defaults);
    message.success('已保存');
    setLoading(false);
  }

  return <>
    <Typography.Title level={3}>写作模型配置</Typography.Title>
    <Typography.Paragraph type="secondary">配置各个写作节点的默认系统模型。用户端会员中心可覆盖此设置。</Typography.Paragraph>
    <Card extra={<Button type="primary" loading={loading} onClick={save}>保存</Button>}>
      {SCENARIOS.map(s => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
          <div style={{ width: 130 }}><Typography.Text strong>{s.label}</Typography.Text></div>
          <Select style={{ flex: 1 }} value={defaults[s.key] || undefined} onChange={v => setDefaults(prev => ({ ...prev, [s.key]: v }))} allowClear placeholder="系统默认">
            {models.map((m: any) => <Select.Option key={m.id} value={m.id}>{m.name} <span style={{ color: '#999', fontSize: 12 }}>{m.provider}</span></Select.Option>)}
          </Select>
        </div>
      ))}
    </Card>
  </>;
}
