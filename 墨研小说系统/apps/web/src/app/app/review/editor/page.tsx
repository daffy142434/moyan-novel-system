'use client';

import '@ant-design/v5-patch-for-react-19';
import { FileSearchOutlined, EyeOutlined, ExclamationCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Descriptions, Form, Input, List, Progress, Radio, Row, Select, Space, Statistic, Tag, Typography, message } from 'antd';
import type { StudioGenerationRunDto } from '@moyan/contracts';
import { useState } from 'react';
import { AppShell } from '../../../../components/AppShell';
import { GenerationStreamDrawer } from '../../../../components/GenerationStreamDrawer';
import { api, readableError, streamStudioGeneration } from '../../../../lib/api';

export default function EditorReviewPage() {
  const [mode, setMode] = useState('domestic');
  const [stage, setStage] = useState('正文剧本');
  const [writerLevel, setWriterLevel] = useState('B');
  const [writerHistory, setWriterHistory] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamRun, setStreamRun] = useState<StudioGenerationRunDto | null>(null);
  const [streamOpen, setStreamOpen] = useState(false);
  const [quickResult, setQuickResult] = useState<{ passed: boolean; hits: { code: string; condition: string; reason: string }[] } | null>(null);
  const [fullResult, setFullResult] = useState<{ grade: string; totalScore: number; dimensionScores: Record<string, { score: number; max: number; comment: string }>; internalNotes: string; fixItems: { code: string; problem: string; suggestion: string }[]; suggestItems: { code: string; problem: string; suggestion: string }[]; writerFeedback: string } | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  async function quickCheck() {
    if (!content.trim()) { messageApi.warning('请先输入剧本内容'); return; }
    setBusy(true); setStreamRun(null); setStreamOpen(true); setQuickResult(null); setFullResult(null);
    try {
      const run = await streamStudioGeneration(
        { scope: 'editor_review_quick', reviewContent: content, reviewMode: mode },
        setStreamRun,
      );
      if (run.status === 'completed') {
        const data = run.result as { passed: boolean; hits: { code: string; condition: string; reason: string }[] };
        setQuickResult(data);
        messageApi.success(data.passed ? '快速淘汰通过，可进入正式审稿' : '稿件被淘汰，请查看详情');
      }
    } catch (error) { messageApi.error(readableError(error)); }
    finally { setBusy(false); }
  }

  async function fullReview() {
    if (!content.trim()) { messageApi.warning('请先输入剧本内容'); return; }
    setBusy(true); setStreamRun(null); setStreamOpen(true);
    try {
      const run = await streamStudioGeneration(
        { scope: 'editor_review_full', reviewContent: content, reviewMode: mode, reviewStage: stage, writerLevel, writerHistory },
        setStreamRun,
      );
      if (run.status === 'completed') {
        setFullResult(run.result as typeof fullResult);
        messageApi.success('正式审稿完成');
      }
    } catch (error) { messageApi.error(readableError(error)); }
    finally { setBusy(false); }
  }

  const gradeColor = (g: string) => ({ A: '#52c41a', B: '#1677ff', C: '#faad14', D: '#ff4d4f' } as Record<string, string>)[g] ?? '#999';

  return <AppShell>{contextHolder}
    <div className="page-heading"><div><div className="eyebrow">EDITOR REVIEW</div><Typography.Title level={2}>编剧主审</Typography.Title><Typography.Text type="secondary">快速淘汰 + 深度审稿，八维打分，给写手的可执行修改意见</Typography.Text></div></div>
    <Row gutter={[18, 18]}>
      <Col xs={24} lg={10}>
        <Card title="审稿配置"><Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Form layout="vertical">
            <Form.Item label="制作模式"><Radio.Group value={mode} onChange={(event) => setMode(event.target.value)} optionType="button" buttonStyle="solid">
              <Radio value="domestic">国内下沉剧</Radio>
              <Radio value="overseas_live">海外仿真人</Radio>
              <Radio value="overseas_ai">海外 AI 剧本</Radio>
            </Radio.Group></Form.Item>
            <Form.Item label="审稿阶段"><Radio.Group value={stage} onChange={(event) => setStage(event.target.value)} optionType="button" buttonStyle="solid">
              <Radio value="选题策划">选题策划</Radio>
              <Radio value="一审材料">一审材料</Radio>
              <Radio value="二审材料">二审材料</Radio>
              <Radio value="正文剧本">正文剧本</Radio>
              <Radio value="全本终审">全本终审</Radio>
            </Radio.Group></Form.Item>
            <Form.Item label="写手等级"><Select value={writerLevel} onChange={setWriterLevel} options={[{ value: 'S', label: 'S 核心写手' }, { value: 'A', label: 'A 成熟写手' }, { value: 'B', label: 'B 合格写手' }, { value: 'C', label: 'C 新手写手' }]} /></Form.Item>
            <Form.Item label="历史问题（可选）"><Input placeholder="例如：台词一直很AI、格式总错" value={writerHistory} onChange={(event) => setWriterHistory(event.target.value)} /></Form.Item>
            <Form.Item label="剧本内容"><Input.TextArea rows={14} value={content} onChange={(event) => setContent(event.target.value)} placeholder="在此粘贴或输入剧本全文……" /></Form.Item>
          </Form>
          <Space><Button icon={<EyeOutlined />} loading={busy} onClick={quickCheck} disabled={!content.trim()}>30秒快速淘汰</Button><Button type="primary" icon={<FileSearchOutlined />} loading={busy} onClick={fullReview} disabled={!content.trim()}>正式审稿</Button></Space>
        </Space></Card>
      </Col>
      <Col xs={24} lg={14}>
        {quickResult && <Card size="small" style={{ marginBottom: 18 }} title="快速淘汰结果" extra={<Tag color={quickResult.passed ? 'success' : 'error'}>{quickResult.passed ? '通过' : '淘汰'}</Tag>}><Alert type={quickResult.passed ? 'success' : 'error'} showIcon message={quickResult.passed ? '快速淘汰通过，可进入正式审稿' : '稿件被快速淘汰'} />{quickResult.hits.length > 0 && <List style={{ marginTop: 12 }} size="small" dataSource={quickResult.hits} renderItem={(item) => <List.Item><Space><Tag color="red">{item.code}</Tag><Typography.Text strong>{item.condition}</Typography.Text><Typography.Text type="secondary">— {item.reason}</Typography.Text></Space></List.Item>} />}</Card>}
        {fullResult ? <Card title="审稿报告" extra={<Tag color={gradeColor(fullResult.grade)} style={{ fontSize: 18, padding: '4px 12px' }}>{fullResult.grade} 级</Tag>}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Statistic title="综合评分" value={fullResult.totalScore} suffix="/ 100" valueStyle={{ color: fullResult.totalScore >= 90 ? '#52c41a' : fullResult.totalScore >= 75 ? '#1677ff' : fullResult.totalScore >= 60 ? '#faad14' : '#ff4d4f' }} />
            <Progress percent={fullResult.totalScore} strokeColor={fullResult.totalScore >= 90 ? '#52c41a' : fullResult.totalScore >= 75 ? '#1677ff' : fullResult.totalScore >= 60 ? '#faad14' : '#ff4d4f'} />
            <Card size="small" title="分项评分"><Descriptions size="small" column={2}>{Object.entries(fullResult.dimensionScores).map(([key, val]) => <Descriptions.Item key={key} label={key}>{val.score}/{val.max} — {val.comment}</Descriptions.Item>)}</Descriptions></Card>
            {fullResult.internalNotes && <Alert type="info" showIcon message="主审内部判断" description={fullResult.internalNotes} />}
            {fullResult.fixItems.length > 0 && <Card size="small" type="inner" title={<><ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> 必改问题（{fullResult.fixItems.length}）</>}><List size="small" dataSource={fullResult.fixItems} renderItem={(item) => <List.Item><Space direction="vertical" size={2}><Space><Tag color="red">{item.code}</Tag><Typography.Text strong>{item.problem}</Typography.Text></Space><Typography.Text type="secondary">建议：{item.suggestion}</Typography.Text></Space></List.Item>} /></Card>}
            {fullResult.suggestItems.length > 0 && <Card size="small" type="inner" title="建议优化"><List size="small" dataSource={fullResult.suggestItems} renderItem={(item) => <List.Item><Space direction="vertical" size={2}><Space><Tag>{item.code}</Tag><Typography.Text>{item.problem}</Typography.Text></Space><Typography.Text type="secondary">建议：{item.suggestion}</Typography.Text></Space></List.Item>} /></Card>}
            {fullResult.writerFeedback && <Card size="small" type="inner" title={<><CheckCircleOutlined style={{ color: '#1677ff' }} /> 给写手的修改意见（可直接复制）</>}><Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{fullResult.writerFeedback}</Typography.Paragraph></Card>}
          </Space>
        </Card> : !quickResult && <Card><div className="center-screen"><Typography.Text type="secondary">配置审稿参数并输入剧本后，先执行快速淘汰，再进行正式审稿</Typography.Text></div></Card>}
      </Col>
    </Row>
    <GenerationStreamDrawer open={streamOpen} title="AI 正在审稿" run={streamRun} onStop={() => streamRun && api.cancelStudioGeneration(streamRun.id)} onClose={() => setStreamOpen(false)} />
  </AppShell>;
}
