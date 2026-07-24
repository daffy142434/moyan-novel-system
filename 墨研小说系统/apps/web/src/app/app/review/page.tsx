'use client';

import '@ant-design/v5-patch-for-react-19';
import { AuditOutlined, FileProtectOutlined } from '@ant-design/icons';
import { Button, Card, Col, Row, Typography } from 'antd';
import Link from 'next/link';
import { AppShell } from '../../../components/AppShell';

export default function ReviewCenterPage() {
  return <AppShell>
    <div className="page-heading"><div><div className="eyebrow">REVIEW CENTER</div><Typography.Title level={2}>审稿中心</Typography.Title><Typography.Text type="secondary">选择审稿工具，对剧本质量进行全面检查</Typography.Text></div></div>
    <Row gutter={[18, 18]}>
      <Col xs={24} md={12}><Link href="/app/review/writer"><Card hoverable><div style={{ padding: '20px 8px', textAlign: 'center' }}><FileProtectOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} /><Typography.Title level={3}>写手自查</Typography.Title><Typography.Paragraph type="secondary">十维全面检查：材料完整性、格式合规、题材合规、节奏、逻辑、人物、台词、可拍性、AI痕迹。输出分级审核报告和修改建议。</Typography.Paragraph><Button type="primary">进入自查</Button></div></Card></Link></Col>
      <Col xs={24} md={12}><Link href="/app/review/editor"><Card hoverable><div style={{ padding: '20px 8px', textAlign: 'center' }}><AuditOutlined style={{ fontSize: 48, color: '#722ed1', marginBottom: 16 }} /><Typography.Title level={3}>编剧主审</Typography.Title><Typography.Paragraph type="secondary">30秒快速淘汰 + 正式深度审稿。逐集逐场批注、八维打分、A/B/C/D等级、给写手的可执行修改意见。支持写手分级管理和历史问题追踪。</Typography.Paragraph><Button style={{ borderColor: '#722ed1', color: '#722ed1' }}>进入主审</Button></div></Card></Link></Col>
    </Row>
  </AppShell>;
}
