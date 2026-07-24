'use client';
import { Button, Modal, Select, Space, Typography, Tag } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';

const API = 'http://localhost:3100/api';
async function f(p: string) { const t = localStorage.getItem('moyan_access_token'); return fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()); }

const SCOPE_TO_NODE: Record<string, string> = {
  proposal: 'proposal',
  outline: 'outline',
  characters: 'characters',
  catalog: 'catalog',
  episode_generate: 'episode_generate',
  episode_optimize: 'episode_optimize',
  episode_review: 'episode_review',
  novel_review: 'novel_review',
};

interface Props {
  open: boolean;
  scope?: string;
  onCancel: () => void;
  onStart: (opts: { modelId?: string; promptKey?: string }) => void;
}

export default function ModelPromptSelector({ open, scope, onCancel, onStart }: Props) {
  const [models, setModels] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [selModel, setSelModel] = useState<string | undefined>();
  const [selPrompt, setSelPrompt] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;

    // 加载模型和用户偏好
    Promise.all([
      f('/studio/models'),
      f('/studio/model-preferences').catch(() => ({})),
    ]).then(([allModels, prefs]: any[]) => {
      setModels(allModels);
      // 查找当前 scope 对应的用户配置的默认模型
      const nodeKey = scope ? SCOPE_TO_NODE[scope] : undefined;
      const prefModelId = nodeKey && prefs[nodeKey]?.modelId;
      if (prefModelId) setSelModel(prefModelId);
    });

    // 加载匹配的提示词
    const nodeKey = scope ? SCOPE_TO_NODE[scope] : undefined;
    if (nodeKey) {
      f('/admin/skill-prompts').catch(() => []).then((allPropts: any[]) => {
        const matched = (allPropts || []).filter((p: any) => p.node_key === nodeKey).sort((a: any, b: any) => a.sort_order - b.sort_order);
        setPrompts(matched);
        const def = matched.find((p: any) => p.is_default);
        if (def) setSelPrompt(def.id);
      });
    }
  }, [open, scope]);

  return (
    <Modal title="选择模型和提示词" open={open} onCancel={onCancel} footer={null} width={480}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            选择模型 {!selModel && <Typography.Text type="secondary" style={{ fontWeight: 400 }}>(用户配置的默认模型)</Typography.Text>}
          </Typography.Text>
          <Select value={selModel} onChange={setSelModel} allowClear placeholder="用户配置的默认模型" style={{ width: '100%' }}>
            {models.filter((m: any) => m.origin === 'system').map((m: any) => (
              <Select.Option key={m.id} value={m.id}>
                <Space><span>{m.name}</span><Tag color="blue" style={{ fontSize: 10 }}>{m.provider}</Tag></Space>
              </Select.Option>
            ))}
          </Select>
        </div>
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>选择提示词</Typography.Text>
          {prompts.length === 0 ? <Typography.Text type="secondary">该操作暂无自定义提示词，将使用系统默认</Typography.Text> : (
            <Select value={selPrompt} onChange={setSelPrompt} allowClear placeholder="使用系统默认" style={{ width: '100%' }}>
              {prompts.map((p: any) => (
                <Select.Option key={p.id} value={p.id}>
                  <Space>
                    <span>{p.name}</span>
                    {p.is_default && <Tag color="green" style={{ fontSize: 10 }}>默认</Tag>}
                  </Space>
                </Select.Option>
              ))}
            </Select>
          )}
        </div>
        <Button type="primary" block size="large" icon={<ThunderboltOutlined />} onClick={() => onStart({ modelId: selModel, promptKey: selPrompt })}>
          开始生成
        </Button>
      </Space>
    </Modal>
  );
}
