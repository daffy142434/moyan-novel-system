'use client';

import '@ant-design/v5-patch-for-react-19';
import { AppShell } from '../../../components/AppShell';
import { api } from '../../../lib/api';
import { Button, Card, Select, Space, Tag, Typography, message, Spin } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';

const SCENARIOS = [
  { key: 'proposal', label: '创作方案生成', desc: '根据用户选择生成短剧策划方案' },
  { key: 'outline', label: '短篇大纲', desc: '生成短篇小说五章大纲' },
  { key: 'characters', label: '角色开发', desc: '生成角色设定与关系描述' },
  { key: 'catalog', label: '目录大纲', desc: '生成分集目录与简介' },
  { key: 'episode_generate', label: '剧集创作', desc: '生成单集剧本/小说章节' },
  { key: 'episode_optimize', label: '剧集优化', desc: '根据建议优化改写已有剧集' },
  { key: 'episode_review', label: '剧集审核', desc: 'AI 自审单集剧本质量' },
  { key: 'novel_review', label: '全篇审核', desc: '审核整部作品的整体质量' },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [models, setModels] = useState<any[]>([]);
  const [prefs, setPrefs] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      api.fetchModels(),
      api.getModelPreferences().catch(() => ({})),
    ]).then(([m, p]) => {
      setModels(m);
      setPrefs(p as Record<string, string>);
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true);
    const data: Record<string, string> = {};
    for (const s of SCENARIOS) { if (prefs[s.key]) data[s.key] = prefs[s.key]; }
    await api.updateModelPreferences(data);
    message.success('模型偏好已保存');
    setSaving(false);
  }

  function setPref(scenario: string, modelId: string) {
    setPrefs(prev => ({ ...prev, [scenario]: modelId || '' }));
  }

  if (loading) return <AppShell><Spin style={{ margin: '60px auto', display: 'block' }} /></AppShell>;

  return (
    <AppShell>
      <div className="eyebrow">SETTINGS</div>
      <Typography.Title level={2}>AI 模型配置</Typography.Title>
      <Typography.Paragraph type="secondary">
        为每个 AI 创作场景指定要使用的模型。不配置则使用系统默认模型 DeepSeek V4 Pro。
        带 <Tag color="orange" style={{ fontSize: 11 }}>自定义</Tag> 标记的是你自行添加的模型。
      </Typography.Paragraph>

      <Card style={{ marginTop: 16 }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {SCENARIOS.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 140, flexShrink: 0 }}>
                <div style={{ fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: '#999' }}>{s.desc}</div>
              </div>
              <Select
                style={{ flex: 1 }}
                value={prefs[s.key] || undefined}
                onChange={(v) => setPref(s.key, v)}
                allowClear
                placeholder="系统默认 (DeepSeek V4 Pro)"
                optionLabelProp="label"
              >
                {/* 系统模型 */}
                {models.filter(m => m.origin === 'system').map(m => (
                  <Select.Option key={m.id} value={m.id} label={m.name}>
                    <Space>
                      <span>{m.name}</span>
                      {m.priority >= 3 && <Tag color="gold" style={{ fontSize: 10 }}>推荐</Tag>}
                      <Tag color="blue" style={{ fontSize: 11 }}>系统</Tag>
                      <span style={{ color: '#999', fontSize: 12 }}>{m.provider}</span>
                    </Space>
                  </Select.Option>
                ))}
                {/* 用户模型 */}
                {models.filter(m => m.origin === 'user').map(m => (
                  <Select.Option key={m.id} value={m.id} label={m.name}>
                    <Space>
                      <span>{m.name}</span>
                      <Tag color="orange" style={{ fontSize: 11 }}>自定义</Tag>
                      <span style={{ color: '#999', fontSize: 12 }}>{m.provider}</span>
                    </Space>
                  </Select.Option>
                ))}
              </Select>
            </div>
          ))}
        </Space>
      </Card>

      <Button type="primary" icon={<SaveOutlined />} onClick={save} loading={saving} style={{ marginTop: 24 }} size="large">
        保存配置
      </Button>
    </AppShell>
  );
}
