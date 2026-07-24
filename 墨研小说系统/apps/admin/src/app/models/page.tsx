'use client';
import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { sysModels } from '@/lib/api';

const PRESETS = [
  { label: 'DeepSeek V4 Pro', provider: 'deepseek', model_id: 'deepseek-chat', base_url: 'https://api.deepseek.com/v1' },
  { label: 'DeepSeek V4 Flash', provider: 'deepseek', model_id: 'deepseek-chat', base_url: 'https://api.deepseek.com/v1' },
  { label: 'GPT-4o', provider: 'openai', model_id: 'gpt-4o', base_url: 'https://api.openai.com/v1' },
  { label: 'GPT-4o Mini', provider: 'openai', model_id: 'gpt-4o-mini', base_url: 'https://api.openai.com/v1' },
  { label: 'Claude 3.5 Sonnet', provider: 'anthropic', model_id: 'claude-3-5-sonnet-20241022', base_url: 'https://api.anthropic.com/v1' },
  { label: 'Kimi (Moonshot)', provider: 'moonshot', model_id: 'moonshot-v1-8k', base_url: 'https://api.moonshot.cn/v1' },
  { label: '自定义', provider: 'custom', model_id: '', base_url: '' },
];

export default function ModelsPage() {
  const [models, setModels] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const [preset, setPreset] = useState('');

  async function load() { const d = await sysModels.list(); setModels(d); }
  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); form.resetFields(); setPreset(''); setOpen(true); }
  function openEdit(record: any) { setEditing(record); form.setFieldsValue(record); setPreset(''); setOpen(true); }

  function applyPreset(key: string) {
    setPreset(key);
    const p = PRESETS.find(x => x.label === key);
    if (!p) { form.setFieldsValue({ provider: 'custom' }); return; }
    form.setFieldsValue({ provider: p.provider, model_id: p.model_id, base_url: p.base_url });
  }

  async function submit() {
    const values = await form.validateFields();
    if (editing) {
      await sysModels.update(editing.id, values);
    } else {
      await sysModels.create(values);
    }
    message.success(editing ? '已更新' : '已创建');
    setOpen(false); load();
  }

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '提供商', dataIndex: 'provider', key: 'provider', render: (v: string) => <Tag>{v}</Tag> },
    { title: '类型', dataIndex: 'model_type', key: 'type', width: 70, render: (v: string) => <Tag color="blue">{v||'text'}</Tag> },
    { title: '缓存价', dataIndex: 'price_per_1k_cache', key: 'pcache', width: 90, render: (v: any) => `¥${Number(v||0).toFixed(5)}/1K` },
    { title: '输入价', dataIndex: 'price_per_1k_input', key: 'pin', width: 90, render: (v: any) => `¥${Number(v||0).toFixed(4)}/1K` },
    { title: '输出价', dataIndex: 'price_per_1k_output', key: 'pout', width: 90, render: (v: any) => `¥${Number(v||0).toFixed(4)}/1K` },
    { title: '最大Token', dataIndex: 'max_output_tokens', key: 'maxt', width: 80, render: (v: any) => v ? `${(v/1000).toFixed(0)}K` : '-' },
    { title: '状态', dataIndex: 'is_enabled', key: 'is_enabled', render: (v: boolean) => v ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag> },
    { title: '排序', dataIndex: 'priority', key: 'priority' },
    { title: '操作', key: 'actions', render: (_: any, r: any) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
        <Popconfirm title="确定删除？" onConfirm={async () => { await sysModels.remove(r.id); load(); message.success('已删除'); }}>
          <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>系统模型管理</h2>
      <Button type="primary" icon={<PlusOutlined />} onClick={openNew} style={{ marginBottom: 16 }}>添加模型</Button>
      <Table dataSource={models} columns={columns} rowKey="id" pagination={false} />

      <Modal title={editing ? '编辑模型' : '添加模型'} open={open} onOk={submit} onCancel={() => setOpen(false)} width={560}>
        <Form form={form} layout="vertical">
          <Form.Item label="快速模板"><Select value={preset} onChange={applyPreset} options={PRESETS.map(p => ({ label: p.label, value: p.label }))} placeholder="选择预设..." /></Form.Item>
          <Form.Item name="name" label="显示名称" rules={[{ required: true }]}><Input placeholder="DeepSeek V4 Pro" /></Form.Item>
          <Form.Item name="provider" label="提供商" rules={[{ required: true }]}>
            <Select options={[{ label: 'DeepSeek', value: 'deepseek' }, { label: 'OpenAI', value: 'openai' }, { label: 'Anthropic', value: 'anthropic' }, { label: 'Moonshot/Kimi', value: 'moonshot' }, { label: '自定义', value: 'custom' }]} />
          </Form.Item>
          <Form.Item name="model_id" label="模型 ID" rules={[{ required: true }]}><Input placeholder="deepseek-chat" /></Form.Item>
          <Form.Item name="base_url" label="API 地址" rules={[{ required: true }]}><Input placeholder="https://api.deepseek.com/v1" /></Form.Item>
          <Form.Item name="api_key" label="API Key" extra="留空则使用系统默认环境变量中的 Key"><Input.Password placeholder="sk-..." /></Form.Item>
          <Form.Item name="priority" label="排序优先级" initialValue={0}><InputNumber min={0} max={100} /></Form.Item>
          <Form.Item name="max_output_tokens" label="最大输出 Token" initialValue={320000}>
            <InputNumber min={100} max={384000} style={{width:150}} />
          </Form.Item>
          <Form.Item name="model_type" label="模型类型" initialValue="text">
            <Select options={[{label:'文本 (text)',value:'text'},{label:'图片 (image)',value:'image'},{label:'视频 (video)',value:'video'}]} />
          </Form.Item>
          <Space size={16} wrap>
            <Form.Item name="price_per_1k_cache" label="缓存价 (¥/1K)" initialValue={0}>
              <InputNumber min={0} step={0.000001} precision={6} style={{width:130}} />
            </Form.Item>
            <Form.Item name="price_per_1k_input" label="输入价 (¥/1K)" initialValue={0.001}>
              <InputNumber min={0} step={0.0001} precision={4} style={{width:130}} />
            </Form.Item>
            <Form.Item name="price_per_1k_output" label="输出价 (¥/1K)" initialValue={0.002}>
              <InputNumber min={0} step={0.0001} precision={4} style={{width:130}} />
            </Form.Item>
          </Space>
          <Form.Item name="is_enabled" label="启用状态" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
