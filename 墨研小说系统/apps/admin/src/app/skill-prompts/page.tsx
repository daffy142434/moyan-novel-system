'use client';
import '@ant-design/v5-patch-for-react-19';
import { Button, Card, message, Modal, Typography, Select, Space, Input, Tag, Switch, Collapse } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CodeOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/api';

const API = 'http://localhost:3100/api';
async function f(p: string, m = 'GET', b?: any) { const t = getToken(); return fetch(`${API}${p}`, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json()); }

const NODES = [
  { key: 'proposal', label: '创作方案生成' },
  { key: 'outline', label: '故事大纲' },
  { key: 'characters', label: '角色开发' },
  { key: 'catalog', label: '目录大纲' },
  { key: 'episode_generate', label: '剧集创作' },
  { key: 'episode_optimize', label: '剧集优化' },
  { key: 'episode_review', label: '剧集审核' },
  { key: 'novel_review', label: '全篇审核' },
];

export default function SkillPromptsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [content, setContent] = useState('');
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [isNew, setIsNew] = useState(false);
  const [selNode, setSelNode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { f('/admin/skill-prompts').then(setItems); }, []);

  function openNew(nodeKey: string) { setIsNew(true); setEdit(null); setContent(''); setName(''); setIsDefault(false); setSortOrder(0); setSelNode(nodeKey); }
  function openEdit(item: any) { setIsNew(false); setEdit(item); setContent(item.prompt_content); setName(item.name || ''); setIsDefault(item.is_default); setSortOrder(item.sort_order || 0); }

  async function save() {
    setLoading(true);
    if (isNew) {
      const node = NODES.find(n => n.key === selNode);
      await f('/admin/skill-prompts', 'POST', { node_key: selNode, node_label: node?.label || selNode, name, prompt_content: content, is_default: isDefault, sort_order: sortOrder });
      message.success('已创建');
    } else if (edit) {
      await f(`/admin/skill-prompts/${edit.id}`, 'PUT', { prompt_content: content, name, is_default: isDefault, sort_order: sortOrder, description: edit.description });
      message.success('已保存');
    }
    setLoading(false);
    setEdit(null); setIsNew(false);
    f('/admin/skill-prompts').then(setItems);
  }

  async function del(id: string) { await f(`/admin/skill-prompts/${id}`, 'DELETE'); message.success('已删除'); f('/admin/skill-prompts').then(setItems); }

  const grouped = NODES.map(n => ({ ...n, prompts: items.filter((i: any) => i.node_key === n.key) }));

  return <>
    <Typography.Title level={3}><CodeOutlined /> SKILL配置</Typography.Title>
    <Typography.Paragraph type="secondary">每个节点可配置多个提示词版本。勾选「默认」的提示词将作为该节点的首选。</Typography.Paragraph>
    {grouped.map(g => (
      <Card key={g.key} title={g.label} size="small" extra={<Button size="small" icon={<PlusOutlined />} onClick={() => openNew(g.key)}>添加</Button>} style={{ marginBottom: 12 }}>
        {g.prompts.length === 0 ? <Typography.Text type="secondary">暂无提示词</Typography.Text> :
          g.prompts.map((p: any) => (
            <Card key={p.id} size="small" style={{ marginBottom: 8, background: p.is_default ? '#f6ffed' : '#fafafa' }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <Typography.Text strong>{p.name}</Typography.Text>
                  {p.is_default && <Tag color="green">默认</Tag>}
                  <Typography.Text type="secondary" ellipsis style={{ maxWidth: 300 }}>{p.prompt_content?.slice(0, 60)}...</Typography.Text>
                </Space>
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(p)}>编辑</Button>
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => del(p.id)}>删除</Button>
                </Space>
              </Space>
            </Card>
          ))}
      </Card>
    ))}
    <Modal title={isNew ? '新增提示词' : `编辑: ${edit?.name}`} open={!!edit || isNew} onOk={save} onCancel={() => { setEdit(null); setIsNew(false); }} confirmLoading={loading} width={700}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {isNew && <Select value={selNode} onChange={setSelNode} style={{ width: '100%' }} options={NODES.map(n => ({ value: n.key, label: n.label }))} placeholder="选择节点" />}
        <Input placeholder="提示词名称" value={name} onChange={e => setName(e.target.value)} />
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div><Switch checked={isDefault} onChange={setIsDefault} /> <Typography.Text>{isDefault ? '默认提示词' : '设为默认'}</Typography.Text></div>
          <Typography.Text>排序: </Typography.Text>
          <Input style={{ width: 80 }} type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value)} style={{ width: '100%', minHeight: 300, fontFamily: 'monospace', fontSize: 13, padding: 12, border: '1px solid #d9d9d9', borderRadius: 6 }} />
      </Space>
    </Modal>
  </>;
}
