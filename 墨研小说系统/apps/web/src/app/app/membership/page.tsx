'use client';

import '@ant-design/v5-patch-for-react-19';
import { Card, Col, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { DashboardDto } from '@moyan/contracts';
import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/AppShell';
import { api } from '../../../lib/api';

export default function MembershipPage() {
  const [data, setData] = useState<DashboardDto | null>(null);
  useEffect(() => { void api.dashboard().then(setData); }, []);
  return <AppShell><div className="eyebrow">MEMBERSHIP & CREDITS</div><Typography.Title level={2}>会员与积分</Typography.Title><Typography.Paragraph type="secondary">积分账本与 Token 统计已经启用；真实充值需配置支付渠道后开放。</Typography.Paragraph>
    <Row gutter={[18, 18]}><Col xs={24} md={8}><Card><Statistic title="当前方案" value={data?.membership.plan.toUpperCase() ?? '-'} /><Tag color="gold">会员配置化</Tag></Card></Col><Col xs={24} md={8}><Card><Statistic title="积分余额" value={data?.membership.creditBalance ?? 0} precision={4} /></Card></Col><Col xs={24} md={8}><Card><Statistic title="本月 Token" value={(data?.usage.inputTokens ?? 0) + (data?.usage.outputTokens ?? 0)} /></Card></Col></Row>
    <Card title="积分流水" style={{ marginTop: 18 }}><Table pagination={false} dataSource={[]} columns={[{ title: '时间', dataIndex: 'time' }, { title: '类型', dataIndex: 'type' }, { title: '作品', dataIndex: 'project' }, { title: '积分', dataIndex: 'amount' }, { title: '余额', dataIndex: 'balance' }]} locale={{ emptyText: '暂无积分流水' }} /></Card>
    <Card title="方案说明" style={{ marginTop: 18 }}><Space wrap size="large"><Tag>FREE</Tag><Tag color="blue">PLUS（待配置）</Tag><Tag color="purple">MAX（待配置）</Tag></Space></Card>
  </AppShell>;
}
