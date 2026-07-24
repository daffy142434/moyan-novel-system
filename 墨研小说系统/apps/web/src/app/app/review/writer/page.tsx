'use client';

import '@ant-design/v5-patch-for-react-19';
import { CheckCircleOutlined, ExclamationCircleOutlined, FileSearchOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Collapse, Descriptions, Form, Input, List, Progress, Radio, Row, Space, Tag, Typography, message } from 'antd';
import type { StudioGenerationRunDto } from '@moyan/contracts';
import { useState } from 'react';
import { AppShell } from '../../../../components/AppShell';
import { GenerationStreamDrawer } from '../../../../components/GenerationStreamDrawer';
import { api, readableError, session, streamStudioGeneration } from '../../../../lib/api';

type ReviewResult = {
  conclusion: string;
  summary: string;
  fixItems: string[];
  suggestItems: string[];
  passItems: string[];
  dimensions: { label: string; result: string; detail: string }[];
  episodeDetails: { number: number; items: { label: string; result: string; detail: string }[] }[];
};

export default function WriterReviewPage() {
  const [mode, setMode] = useState('domestic');
  const [stage, setStage] = useState('正文剧本');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamRun, setStreamRun] = useState<StudioGenerationRunDto | null>(null);
  const [streamOpen, setStreamOpen] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  async function review(quick = false) {
    if (!content.trim()) { messageApi.warning('请输入或粘贴剧本内容'); return; }
    setBusy(true); setStreamRun(null); setStreamOpen(true);
    try {
      const run = await streamStudioGeneration(
        { scope: 'writer_review', reviewContent: content, reviewMode: mode, reviewStage: stage, instruction: quick ? '快速审核' : '完整审核' },
        setStreamRun,
      );
      if (run.status === 'completed') {
        const data = run.result as ReviewResult;
        setResult(data);
        const conclusionMap: Record<string, string> = { pass: '通过', conditional: '有条件通过', fail: '不通过' };
        messageApi.success(`审核完成：${conclusionMap[data.conclusion] ?? data.conclusion}`);
      }
    } catch (error) { messageApi.error(readableError(error)); }
    finally { setBusy(false); }
  }

  const conclusionTag = (conclusion: string) => {
    const map: Record<string, { color: string; text: string }> = {
      pass: { color: 'success', text: '通过' },
      conditional: { color: 'warning', text: '有条件通过' },
      fail: { color: 'error', text: '不通过' },
    };
    return map[conclusion] ?? { color: 'default', text: conclusion };
  };
  const dimensionIcon = (status: string) => {
    if (status === 'fail') return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
    if (status === 'warn') return <WarningOutlined style={{ color: '#faad14' }} />;
    return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
  };

  return <AppShell>{contextHolder}
    <div className="page-heading"><div><div className="eyebrow">WRITER SELF-REVIEW</div><Typography.Title level={2}>写手自查</Typography.Title><Typography.Text type="secondary">提交剧本，按十大维度全面检查，输出分级审核报告</Typography.Text></div></div>
    <Row gutter={[18, 18]}>
      <Col xs={24} lg={12}>
        <Card title="审核配置"><Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Form layout="vertical">
            <Form.Item label="制作模式"><Radio.Group value={mode} onChange={(event) => setMode(event.target.value)} optionType="button" buttonStyle="solid">
              <Radio value="domestic">国内下沉剧</Radio>
              <Radio value="overseas_live">海外仿真人</Radio>
              <Radio value="overseas_ai">海外 AI 剧本</Radio>
            </Radio.Group></Form.Item>
            <Form.Item label="审核阶段"><Radio.Group value={stage} onChange={(event) => setStage(event.target.value)} optionType="button" buttonStyle="solid">
              <Radio value="一审材料">一审材料</Radio>
              <Radio value="二审材料">二审材料</Radio>
              <Radio value="正文剧本">正文剧本</Radio>
              <Radio value="全本">全本</Radio>
            </Radio.Group></Form.Item>
            <Form.Item label="剧本内容"><Input.TextArea rows={16} value={content} onChange={(event) => setContent(event.target.value)} placeholder="在此粘贴或输入剧本全文……" /></Form.Item>
          </Form>
          <Space><Button type="primary" icon={<FileSearchOutlined />} loading={busy} onClick={() => review(false)} disabled={!content.trim()}>完整审核</Button><Button icon={<ReloadOutlined />} loading={busy} onClick={() => review(true)} disabled={!content.trim()}>快速审核</Button></Space>
        </Space></Card>
      </Col>
      <Col xs={24} lg={12}>
        {!result ? <Card><div className="center-screen"><Typography.Text type="secondary">提交左侧配置并点击审核后，结果将在此显示</Typography.Text></div></Card> : <Card title="审核报告" extra={<Tag color={conclusionTag(result.conclusion).color}>{conclusionTag(result.conclusion).text}</Tag>}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert type={result.conclusion === 'pass' ? 'success' : result.conclusion === 'conditional' ? 'warning' : 'error'} showIcon message={result.summary} />
            {result.fixItems.length > 0 && <Card size="small" title={<><ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> 必改项（{result.fixItems.length}）</>} type="inner"><List size="small" dataSource={result.fixItems} renderItem={(item, idx) => <List.Item>{idx + 1}. {item}</List.Item>} /></Card>}
            {result.suggestItems.length > 0 && <Card size="small" title={<><WarningOutlined style={{ color: '#faad14' }} /> 建议项（{result.suggestItems.length}）</>} type="inner"><List size="small" dataSource={result.suggestItems} renderItem={(item, idx) => <List.Item>{idx + 1}. {item}</List.Item>} /></Card>}
            {result.passItems.length > 0 && <Card size="small" title={<><CheckCircleOutlined style={{ color: '#52c41a' }} /> 通过项（{result.passItems.length}）</>} type="inner"><List size="small" dataSource={result.passItems} renderItem={(item) => <List.Item><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />{item}</List.Item>} /></Card>}
            <Card size="small" title="十维详细检查">
              {result.dimensions.map((dim) => <div key={dim.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}><Space>{dimensionIcon(dim.result)}<Typography.Text>{dim.label}</Typography.Text></Space><Typography.Text type="secondary">{dim.detail}</Typography.Text></div>)}
            </Card>
            {result.episodeDetails.length > 0 && <Collapse items={[{ key: 'episodes', label: `逐集明细（${result.episodeDetails.length} 集）`, children: result.episodeDetails.map((ep) => <Card size="small" key={ep.number} title={`第 ${ep.number} 集`} style={{ marginBottom: 8 }}>{ep.items.map((item) => <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><Space>{dimensionIcon(item.result)}<Typography.Text>{item.label}</Typography.Text></Space><Typography.Text type="secondary">{item.detail}</Typography.Text></div>)}</Card>) }]} />}
          </Space>
        </Card>}
      </Col>
    </Row>
    <GenerationStreamDrawer open={streamOpen} title="正在审核剧本" run={streamRun} onStop={() => streamRun && api.cancelStudioGeneration(streamRun.id)} onClose={() => setStreamOpen(false)} />
  </AppShell>;
}
