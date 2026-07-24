'use client';
import '@ant-design/v5-patch-for-react-19';
import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Table, Tag, Tabs, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TagsOutlined } from '@ant-design/icons';
import { productConfigs } from '@/lib/api';

const CATEGORIES = [
  { key: 'mode', label: '制作模式' },
  { key: 'genre', label: '作品题材' },
  { key: 'tone', label: '故事基调' },
  { key: 'audience', label: '作品频道' },
  { key: 'ending', label: '结局类型' },
  { key: 'language', label: '输出语言' },
];

const PRODUCTS = [
  { key: 'short_drama', label: '短剧 (short_drama)' },
  { key: 'comic_drama', label: '漫剧 (comic_drama)' },
];

export default function ProductConfigsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const [activeProduct, setActiveProduct] = useState('short_drama');

  async function load() {
    setLoading(true);
    const d = await productConfigs.list();
    setData(d);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function save(values: any) {
    await productConfigs.save({ ...values, id: editing?.id });
    message.success('已保存');
    setOpen(false);
    setEditing(null);
    form.resetFields();
    void load();
  }

  async function remove(id: string) {
    await productConfigs.remove(id);
    message.success('已删除');
    void load();
  }

  function edit(record: any) {
    setEditing(record);
    form.setFieldsValue({
      product_type: record.product_type,
      category: record.category,
      value: record.value,
      label: record.label,
      description: record.description || '',
      recommendation: record.recommendation || 0,
      tags: (record.tags || []).join(', '),
      channel: record.channel || undefined,
      compatible_modes: (record.compatible_modes || []).join(', '),
    });
    setOpen(true);
  }

  function openNew(category: string) {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ product_type: activeProduct, category, recommendation: 0 });
    setOpen(true);
  }

  const renderTable = (category: string) => {
    const rows = data.filter(d => d.product_type === activeProduct && d.category === category);
    const columns = [
      { title: '值', dataIndex: 'value', key: 'value', width: 100 },
      { title: '标签', dataIndex: 'label', key: 'label', width: 120 },
      { title: '描述', dataIndex: 'description', key: 'desc', ellipsis: true },
      { title: '推荐度', dataIndex: 'recommendation', key: 'rec', width: 80 },
      {
        title: '推荐标签', dataIndex: 'tags', key: 'tags', width: 160,
        render: (t: string[]) => t?.length ? t.map(tag => <Tag key={tag} color="orange" style={{ fontSize: 11 }}>{tag}</Tag>) : null,
      },
      { title: '频道', dataIndex: 'channel', key: 'ch', width: 60, render: (v: string) => v ? <Tag>{v}</Tag> : null },
      {
        title: '', key: 'actions', width: 80,
        render: (_: any, r: any) => (
          <Space size={4}>
            <Button size="small" icon={<EditOutlined />} onClick={() => edit(r)} />
            <Popconfirm title="确定删除？" onConfirm={() => remove(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ),
      },
    ];
    return (
      <Card
        key={category}
        title={CATEGORIES.find(c => c.key === category)?.label || category}
        extra={<Button type="link" icon={<PlusOutlined />} onClick={() => openNew(category)}>添加</Button>}
        style={{ marginTop: 12 }}
      >
        <Table rowKey="id" columns={columns} dataSource={rows} pagination={false} size="small" />
      </Card>
    );
  };

  return (
    <>
      <Typography.Title level={3}><TagsOutlined /> 作品配置</Typography.Title>
      <Typography.Paragraph type="secondary">配置制作模式、作品题材、故事基调等选项的枚举值、推荐标签和排序。带橙色标签的选项会在用户端标记为"推荐"。</Typography.Paragraph>

      <Tabs activeKey={activeProduct} onChange={setActiveProduct} items={PRODUCTS.map(p => ({ key: p.key, label: p.label }))} />

      {loading ? <Typography.Text type="secondary">加载中...</Typography.Text> : CATEGORIES.map(c => renderTable(c.key))}

      <Modal
        title={editing ? '编辑配置' : '添加配置'}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null); }}
        onOk={() => form.submit()}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="product_type" label="产品类型" rules={[{ required: true }]}>
            <Select options={[...PRODUCTS, { key: '*', label: '全局 (*)' }].map(p => ({ value: p.key, label: p.label }))} />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Select options={CATEGORIES.map(c => ({ value: c.key, label: c.label }))} />
          </Form.Item>
          <Form.Item name="value" label="枚举值" rules={[{ required: true }]}><Input placeholder="如: domistic" /></Form.Item>
          <Form.Item name="label" label="显示名称" rules={[{ required: true }]}><Input placeholder="如: 霸道总裁" /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Space size={16}>
            <Form.Item name="recommendation" label="推荐度（越大越靠前）"><InputNumber min={0} max={10} /></Form.Item>
            <Form.Item name="channel" label="适用频道"><Select allowClear options={[{ label: '男频', value: 'male' }, { label: '女频', value: 'female' }, { label: '全年龄', value: 'all' }]} style={{ width: 120 }} /></Form.Item>
          </Space>
          <Form.Item name="tags" label="推荐标签（逗号分隔，如: 推荐,爆款）" extra="前端会高亮显示"><Input placeholder="推荐, 爆款" /></Form.Item>
          <Form.Item name="compatible_modes" label="兼容模式（逗号分隔）" extra="仅适用于特定制作模式时填写"><Input placeholder="domestic, overseas_ai" /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
