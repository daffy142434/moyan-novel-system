'use client';

import '@ant-design/v5-patch-for-react-19';
import {
  Button, Card, Col, Form, Input, InputNumber, message, Modal, Progress, Row, Select,
  Space, Statistic, Table, Tag, Typography, Divider, List, Switch, Popconfirm, Tabs
} from 'antd';
import {
  WalletOutlined, CrownOutlined, SettingOutlined, ShopOutlined, ThunderboltOutlined,
  DeleteOutlined, PlusOutlined, EditOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/AppShell';

const API = 'http://localhost:3100/api';
async function f(p: string, m = 'GET', b?: any) {
  const t = localStorage.getItem('moyan_access_token');
  return fetch(`${API}${p}`, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json());
}

// ==================== 看板 ====================
function DashboardTab() {
  const [sub, setSub] = useState<any>(null);
  const [usage, setUsage] = useState<any[]>([]);
  const [quota, setQuota] = useState(10000);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    f('/membership/subscription').then((d: any) => { setSub(d); setQuota(d.monthlyCredits || 10000); });
    f('/membership/usage-stats').then(setUsage);
  }, []);

  const totalCalls = usage.reduce((s: number, d: any) => s + Number(d.calls || 0), 0);
  const totalTokens = usage.reduce((s: number, d: any) => s + Number(d.tokens || 0), 0);

  async function saveQuota() {
    setSaving(true);
    await f('/membership/credits/monthly-quota', 'PUT', { monthlyCredits: quota });
    message.success('月配额已更新');
    setSaving(false);
  }

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col span={6}><Card><Statistic title="积分余额" value={sub?.creditBalance?.toFixed(0) || 0} prefix={<WalletOutlined />} suffix="积分" /></Card></Col>
        <Col span={6}><Card><Statistic title="当前套餐" value={sub?.plan?.toUpperCase() || '-'} prefix={<CrownOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="本月调用" value={totalCalls} suffix="次" /></Card></Col>
        <Col span={6}><Card><Statistic title="本月Token" value={totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : totalTokens} /></Card></Col>
      </Row>
      <Card title="月积分配额" size="small">
        <Space>
          <InputNumber value={quota} onChange={v => setQuota(v || 0)} min={0} style={{ width: 150 }} />
          <Button type="primary" loading={saving} onClick={saveQuota} icon={<ReloadOutlined />}>重置并保存</Button>
          <Typography.Text type="secondary">/ {sub?.creditsUsedThisMonth || 0} 本月已用</Typography.Text>
        </Space>
      </Card>
    </Space>
  );
}

// ==================== 套餐 ====================
function PlansTab() {
  const [plans, setPlans] = useState<any[]>([]);
  const [sub, setSub] = useState<any>(null);

  useEffect(() => {
    f('/membership/plans').then(setPlans);
    f('/membership/subscription').then(setSub);
  }, []);

  const tierOrder: Record<string, number> = { free: 0, plus: 1, max: 2 };
  const currentTier = tierOrder[sub?.plan] ?? 0;

  async function subscribe(planId: string) {
    await f('/membership/subscribe', 'POST', { planId, period: 'monthly' });
    message.success('订阅成功');
    f('/membership/subscription').then(setSub);
  }

  return (
    <Row gutter={16}>
      {plans.map((p: any) => {
        const tierLevel = tierOrder[p.tier] ?? 0;
        const isCurrent = p.tier === sub?.plan;
        const isUpgrade = tierLevel > currentTier;
        const isDowngrade = tierLevel < currentTier;

        return (
          <Col span={8} key={p.id}>
            <Card
              title={<Space><Typography.Text strong>{p.name}</Typography.Text>{isCurrent && <Tag color="green">当前</Tag>}</Space>}
              style={{ textAlign: 'center', border: isCurrent ? '2px solid #1677ff' : undefined }}
            >
              <Statistic title="月费" value={p.price_monthly} prefix="¥" suffix="/月" />
              <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>{p.credits_monthly} 积分/月</Typography.Paragraph>
              <Divider />
              <Typography.Text>{(p.features as string[] || []).join('、')}</Typography.Text>
              <Divider />
              {isCurrent && <Button block disabled>当前套餐</Button>}
              {isUpgrade && <Button block type="primary" onClick={() => subscribe(p.id)}>升级至此套餐</Button>}
              {isDowngrade && <Button block disabled>不支持降级</Button>}
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}

// ==================== 模型配置 ====================
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

function ModelConfigTab() {
  const [models, setModels] = useState<any[]>([]);
  const [userModels, setUserModels] = useState<any[]>([]);
  const [prefs, setPrefs] = useState<Record<string, any>>({});
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => { load(); }, []);
  function load() {
    f('/studio/models').then(setModels);
    f('/studio/user-models').then(setUserModels);
    f('/studio/model-preferences').then(setPrefs);
  }

  async function setPref(key: string, modelId: string) {
    await f('/studio/model-preferences', 'PUT', { [key]: modelId || '' });
    f('/studio/model-preferences').then(setPrefs);
    message.success('已更新');
  }

  async function deleteUserModel(id: string) {
    await f(`/studio/user-models/${id}`, 'DELETE');
    message.success('已删除');
    load();
  }

  const allModels = [...models.filter((m: any) => m.origin === 'system'), ...userModels.map((m: any) => ({ ...m, origin: 'user' }))];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Card title="自定义模型" extra={<Button icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>添加模型</Button>}>
        {userModels.length === 0 ? <Typography.Text type="secondary">暂无自定义模型，可添加第三方 API 模型</Typography.Text> : (
          <List dataSource={userModels} renderItem={(m: any) => (
            <List.Item actions={[<Button danger icon={<DeleteOutlined />} key="del" onClick={() => deleteUserModel(m.id)}>删除</Button>]}>
              <List.Item.Meta title={m.name} description={`${m.provider} / ${m.model_id}`} />
            </List.Item>
          )} />
        )}
      </Card>

      <Card title="节点模型绑定">
        <Typography.Paragraph type="secondary">为每个创作节点单独指定默认模型。留空使用系统默认。</Typography.Paragraph>
        {NODES.map(n => (
          <div key={n.key} style={{ marginBottom: 12 }}>
            <Typography.Text strong style={{ display: 'inline-block', width: 120 }}>{n.label}</Typography.Text>
            <Select
              value={prefs[n.key]?.modelId || undefined}
              onChange={v => setPref(n.key, v)}
              allowClear
              placeholder="系统默认"
              style={{ width: 300 }}
            >
              {allModels.map((m: any) => (
                <Select.Option key={m.id} value={m.id}>
                  {m.name} <Tag color="blue" style={{ fontSize: 10 }}>{m.provider}{m.origin === 'user' ? '(自建)' : ''}</Tag>
                </Select.Option>
              ))}
            </Select>
          </div>
        ))}
      </Card>

      <AddModelModal open={addOpen} onClose={() => setAddOpen(false)} onDone={load} />
    </Space>
  );
}

function AddModelModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('custom');
  const [modelId, setModelId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [maxTokens, setMaxTokens] = useState(320000);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    await f('/studio/user-models', 'POST', { name, provider, model_id: modelId, base_url: baseUrl, api_key: apiKey, max_output_tokens: maxTokens });
    message.success('模型已添加');
    setLoading(false);
    onClose();
    onDone();
  }

  return (
    <Modal title="添加自定义模型" open={open} onCancel={onClose} onOk={save} confirmLoading={loading}>
      <Form layout="vertical">
        <Form.Item label="模型名称"><Input value={name} onChange={e => setName(e.target.value)} placeholder="如：我的DeepSeek" /></Form.Item>
        <Form.Item label="提供商"><Input value={provider} onChange={e => setProvider(e.target.value)} /></Form.Item>
        <Form.Item label="模型ID"><Input value={modelId} onChange={e => setModelId(e.target.value)} placeholder="如：deepseek-chat" /></Form.Item>
        <Form.Item label="Base URL"><Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="如：https://api.deepseek.com/v1" /></Form.Item>
        <Form.Item label="API Key"><Input.Password value={apiKey} onChange={e => setApiKey(e.target.value)} /></Form.Item>
        <Form.Item label="最大输出 Token"><InputNumber value={maxTokens} onChange={v => setMaxTokens(v || 320000)} min={100} max={384000} style={{ width: '100%' }} /></Form.Item>
      </Form>
    </Modal>
  );
}

// ==================== 模型广场 ====================
function MarketplaceTab() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    f('/membership/model-marketplace').then((d: any[]) => setItems(d || []));
  }, []);

  // 按 provider 分组
  const grouped: Record<string, any[]> = {};
  for (const m of items) {
    const p = m.provider || 'other';
    if (!grouped[p]) grouped[p] = [];
    grouped[p].push(m);
  }

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Typography.Paragraph type="secondary">展示系统中可用的大语言模型及其计费信息。</Typography.Paragraph>
      {Object.entries(grouped).map(([provider, models]) => (
        <Card key={provider} title={<Space><Tag color="purple">{provider.toUpperCase()}</Tag><Typography.Text type="secondary">{models.length} 个模型</Typography.Text></Space>} size="small">
          <Table
            pagination={false}
            dataSource={models}
            rowKey="id"
            columns={[
              { title: '模型', dataIndex: 'model_name', render: (v: string, r: any) => <Space><Typography.Text strong>{v}</Typography.Text>{r.model_type && <Tag>{r.model_type}</Tag>}</Space> },
              { title: '输入/1K', dataIndex: 'input_price_per_1k', render: (v: any) => `¥${Number(v || 0).toFixed(4)}` },
              { title: '输出/1K', dataIndex: 'output_price_per_1k', render: (v: any) => `¥${Number(v || 0).toFixed(4)}` },
              { title: '缓存/1K', dataIndex: 'cache_price_per_1k', render: (v: any) => `¥${Number(v || 0).toFixed(4)}` },
            ]}
          />
        </Card>
      ))}
    </Space>
  );
}

// ==================== 主页面 ====================
export default function MembershipPage() {
  return (
    <AppShell>
      <Typography.Title level={3}><CrownOutlined /> 会员中心</Typography.Title>
      <Tabs
        defaultActiveKey="dashboard"
        items={[
          { key: 'dashboard', label: <span><WalletOutlined /> 看板</span>, children: <DashboardTab /> },
          { key: 'plans', label: <span><CrownOutlined /> 套餐</span>, children: <PlansTab /> },
          { key: 'models', label: <span><SettingOutlined /> 模型配置</span>, children: <ModelConfigTab /> },
          { key: 'marketplace', label: <span><ShopOutlined /> 模型广场</span>, children: <MarketplaceTab /> },
        ]}
      />
    </AppShell>
  );
}
