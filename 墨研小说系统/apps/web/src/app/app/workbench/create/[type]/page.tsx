'use client';

import '@ant-design/v5-patch-for-react-19';
import { ArrowLeftOutlined, ArrowRightOutlined, CheckOutlined, LockOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Descriptions, Form, Input, Modal, Radio, Row, Select, Space, Spin, Steps, Tag, Typography, message } from 'antd';
import type { ChoiceOptionDto, CreationSessionDto, ProductDefinitionDto, ProductType, StudioGenerationRunDto } from '@moyan/contracts';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '../../../../../components/AppShell';
import { GenerationStreamDrawer } from '../../../../../components/GenerationStreamDrawer';
import { api, readableError, session, streamStudioGeneration } from '../../../../../lib/api';

type WizardStep = 'mode' | 'genre' | 'visualStyle' | 'settings' | 'proposal';

export default function CreationWizardPage() {
  const params = useParams<{ type: string }>();
  const productType = params.type as ProductType;
  const router = useRouter();
  const initialized = useRef(false);
  const [product, setProduct] = useState<ProductDefinitionDto | null>(null);
  const [creation, setCreation] = useState<CreationSessionDto | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<Record<string, unknown>>({ episodeCount: 60, language: 'zh-CN' });
  const [instruction, setInstruction] = useState('');
  const [proposalContent, setProposalContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamRun, setStreamRun] = useState<StudioGenerationRunDto | null>(null);
  const [streamOpen, setStreamOpen] = useState(false);
  const [selectionDetailOpen, setSelectionDetailOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const steps = useMemo<WizardStep[]>(() => productType === 'comic_drama'
    ? ['mode', 'genre', 'visualStyle', 'settings', 'proposal']
    : ['mode', 'genre', 'settings', 'proposal'], [productType]);
  const step = steps[stepIndex];

  useEffect(() => {
    if (!session.hasToken()) { router.replace('/'); return; }
    if (initialized.current) return;
    initialized.current = true;
    Promise.all([api.products(), api.createSession(productType)])
      .then(([products, next]) => {
        const selected = products.find((item) => item.type === productType && item.enabled);
        if (!selected) throw new Error('该创作能力暂不可用');
        setProduct(selected); setCreation(next); setValues({ episodeCount: 60, language: 'zh-CN', ...next.selections }); setProposalContent(next.proposalContent);
      })
      .catch((error) => messageApi.error(readableError(error)));
  }, [messageApi, productType, router]);

  async function persist() {
    if (!creation) return null;
    const next = await api.updateSession(creation.id, { selections: values });
    setCreation(next); return next;
  }
  function validateCurrent() {
    const key = step;
    if (key === 'settings') return ['audience', 'tone', 'ending', 'episodeCount', 'language'].every((item) => values[item] !== undefined && values[item] !== '');
    if (key === 'proposal') return true;
    return Boolean(values[key]);
  }
  async function next() {
    if (!validateCurrent()) { messageApi.warning('请先完成当前选择'); return; }
    setBusy(true);
    try { await persist(); setStepIndex((current) => Math.min(current + 1, steps.length - 1)); }
    catch (error) { messageApi.error(readableError(error)); }
    finally { setBusy(false); }
  }
  async function generateProposal() {
    if (!creation) return;
    setBusy(true);
    try {
      await persist();
      setStreamRun(null); setStreamOpen(true);
      const run = await streamStudioGeneration(
        { scope: 'proposal', sessionId: creation.id, instruction },
        setStreamRun,
      );
      if (run.status === 'cancelled') return;
      const nextSession = run.result as CreationSessionDto;
      setCreation(nextSession); setProposalContent(nextSession.proposalContent);
      messageApi.success('创作方案已生成，可以继续对话调整或直接编辑');
    } catch (error) { messageApi.error(readableError(error)); }
    finally { setBusy(false); }
  }
  function stopGeneration() {
    if (streamRun) void api.cancelStudioGeneration(streamRun.id);
  }
  async function saveProposal() {
    if (!creation) return;
    setBusy(true);
    try { const nextSession = await api.updateSession(creation.id, { proposalContent, selectedTitle: creation.selectedTitle }); setCreation(nextSession); messageApi.success('方案已保存'); }
    catch (error) { messageApi.error(readableError(error)); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!creation || !proposalContent.trim()) { messageApi.warning('请先生成创作方案'); return; }
    setBusy(true);
    try {
      await api.updateSession(creation.id, { proposalContent, selectedTitle: creation.selectedTitle });
      const project = await api.confirmSession(creation.id, creation.selectedTitle);
      router.push(`/app/stories/${project.id}`);
    } catch (error) { messageApi.error(readableError(error)); setBusy(false); }
  }
  function choose(key: string, value: unknown) { setValues((current) => ({ ...current, [key]: value })); }
  function chooseGenre(value: string) {
    const genre = product?.genres.find((item) => item.value === value);
    setValues((current) => ({ ...current, genre: value, audience: genre?.channel ?? 'all' }));
  }
  if (!product || !creation) return <div className="center-screen"><Spin size="large" /></div>;
  const titleMap: Record<WizardStep, string> = { mode: '选择制作模式', genre: '选择题材', visualStyle: '选择视觉风格', settings: '补充创作设定', proposal: '生成并确认创作方案' };
  return <AppShell narrow>{contextHolder}<div className="wizard-shell">
    <div className="wizard-kicker">{product.title} · 第 {stepIndex + 1} 步 / 共 {steps.length} 步</div>
    <Typography.Title level={2}>{titleMap[step]}</Typography.Title>
    <Typography.Paragraph type="secondary">完成必要选择后，系统将根据这些信息生成创作方案。</Typography.Paragraph>
    <Steps
      className="wizard-steps"
      current={stepIndex}
      responsive
      items={steps.map((item) => ({ title: titleMap[item] }))}
    />
    <Card className="wizard-card">
      <Form layout="vertical" requiredMark={false}>
      {step === 'mode' && <Form.Item label="制作模式"><ChoiceGrid options={product.modes} value={String(values.mode ?? '')} onChange={(value) => choose('mode', value)} /></Form.Item>}
      {step === 'genre' && <Form.Item label="作品题材"><ChoiceGrid options={product.genres} value={String(values.genre ?? '')} onChange={chooseGenre} /></Form.Item>}
      {step === 'visualStyle' && <Form.Item label="视觉风格"><ChoiceGrid options={product.visualStyles ?? []} value={String(values.visualStyle ?? '')} onChange={(value) => choose('visualStyle', value)} /></Form.Item>}
      {step === 'settings' && <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <Form.Item label="作品频道" extra="频道由所选题材确定，不可修改"><Input value={choiceLabel(product.settings.audiences, values.audience)} prefix={<LockOutlined />} disabled /></Form.Item>
        <SettingChoice label="故事基调" options={product.settings.tones} value={values.tone} onChange={(value) => choose('tone', value)} />
        <SettingChoice label="结局类型" options={product.settings.endings} value={values.ending} onChange={(value) => choose('ending', value)} />
        <div className="brief-grid"><Form.Item label="集数规模"><Select style={{ width: '100%' }} value={Number(values.episodeCount ?? 60)} options={product.settings.episodeCounts.map((value) => ({ value, label: `${value} 集` }))} onChange={(value) => choose('episodeCount', value)} /></Form.Item><Form.Item label="输出语言"><Select style={{ width: '100%' }} value={String(values.language ?? 'zh-CN')} options={product.settings.languages.map((item) => ({ value: item.value, label: item.label }))} onChange={(value) => choose('language', value)} /></Form.Item></div>
        <Form.Item label="特殊要求与补充设定"><Input.TextArea rows={4} maxLength={2000} showCount value={String(values.specialRequirements ?? '')} onChange={(event) => choose('specialRequirements', event.target.value)} placeholder="例如人物职业、必须出现的反转、需要规避的内容……" /></Form.Item>
      </Space>}
      {step === 'proposal' && <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert type="success" showIcon message="选择已完成" description={<Space direction="vertical" size={4} style={{ width: '100%' }}><SelectionSummary product={product} values={values} /><Button type="link" style={{ padding: 0, alignSelf: 'flex-start' }} onClick={() => setSelectionDetailOpen(true)}>查看详细选择</Button></Space>} />
        <Input.TextArea rows={3} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="与模型补充本次要求；重新生成时也会携带" />
        <Button type="primary" icon={creation.proposalContent ? <ReloadOutlined /> : <ArrowRightOutlined />} loading={busy} onClick={generateProposal}>{creation.proposalContent ? '根据要求重新生成' : '生成创作方案'}</Button>
        {creation.proposalContent && <><div><Typography.Text strong>推荐标题</Typography.Text><Radio.Group className="title-options" value={creation.selectedTitle} onChange={(event) => setCreation({ ...creation, selectedTitle: event.target.value })}>{creation.titleOptions.map((title) => <Radio.Button value={title} key={title}>{title}</Radio.Button>)}</Radio.Group></div><Input.TextArea className="proposal-editor" rows={22} value={proposalContent} onChange={(event) => setProposalContent(event.target.value)} /><Space><Button icon={<SaveOutlined />} onClick={saveProposal} loading={busy}>保存修改</Button><Button type="primary" icon={<CheckOutlined />} onClick={confirm} loading={busy}>确认方案并创建作品</Button></Space></>}
      </Space>}
      </Form>
    </Card>
    {step !== 'proposal' && <div className="wizard-actions"><Button disabled={stepIndex === 0 || busy} icon={<ArrowLeftOutlined />} onClick={() => setStepIndex((current) => current - 1)}>上一步</Button><Button type="primary" loading={busy} onClick={next}>下一步 <ArrowRightOutlined /></Button></div>}
    {step === 'proposal' && <div className="wizard-actions"><Button disabled={busy} icon={<ArrowLeftOutlined />} onClick={() => setStepIndex((current) => current - 1)}>上一步</Button></div>}
    <GenerationStreamDrawer open={streamOpen} title="正在生成创作方案" run={streamRun} onStop={stopGeneration} onClose={() => setStreamOpen(false)} />
    <Modal title="创作选择详情" open={selectionDetailOpen} footer={null} onCancel={() => setSelectionDetailOpen(false)}><SelectionSummary product={product} values={values} detailed /><Descriptions style={{ marginTop: 16 }} size="small" column={1} items={[{ key: 'special', label: '特殊要求', children: String(values.specialRequirements || '无') }]} /></Modal>
  </div></AppShell>;
}

function ChoiceGrid({ options, value, onChange }: { options: ChoiceOptionDto[]; value: string; onChange: (value: string) => void }) {
  return <Radio.Group className="choice-group" value={value} onChange={(event) => onChange(event.target.value)}><Row gutter={[14, 14]}>{options.map((item) => <Col xs={24} md={12} key={item.value}><Radio className="choice-radio" value={item.value}><Card hoverable size="small" className="choice-card"><Space direction="vertical" size={8} style={{ width: '100%' }}><Space style={{ justifyContent: 'space-between', width: '100%' }}><Typography.Text strong>{item.label}</Typography.Text>{item.recommendation && <Tag color={item.recommendation >= 4 ? 'gold' : 'default'}>{'★'.repeat(item.recommendation)}</Tag>}</Space><Typography.Text type="secondary">{item.description}</Typography.Text>{item.tags?.length ? <Space wrap>{item.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space> : null}</Space></Card></Radio></Col>)}</Row></Radio.Group>;
}

function SettingChoice({ label, options, value, onChange }: { label: string; options: ChoiceOptionDto[]; value: unknown; onChange: (value: string) => void }) {
  return <Form.Item label={label}><Radio.Group optionType="button" buttonStyle="solid" value={value} onChange={(event) => onChange(event.target.value)} options={options.map((item) => ({ value: item.value, label: item.label }))} /></Form.Item>;
}

function SelectionSummary({ product, values, detailed = false }: { product: ProductDefinitionDto; values: Record<string, unknown>; detailed?: boolean }) {
  if (!detailed) {
    return <Descriptions size="small" column={{ xs: 1, sm: 3 }} items={[
      { key: 'mode', label: '制作模式', children: choiceLabel(product.modes, values.mode) },
      { key: 'genre', label: '作品题材', children: choiceLabel(product.genres, values.genre) },
      { key: 'setting', label: '创作设定', children: `${choiceLabel(product.settings.audiences, values.audience)} · ${choiceLabel(product.settings.tones, values.tone)} · ${values.episodeCount ?? '-'} 集` },
    ]} />;
  }
  const items = [
    { key: 'mode', label: '制作模式', children: choiceLabel(product.modes, values.mode) },
    { key: 'genre', label: '作品题材', children: choiceLabel(product.genres, values.genre) },
    { key: 'channel', label: '作品频道', children: choiceLabel(product.settings.audiences, values.audience) },
    { key: 'tone', label: '故事基调', children: choiceLabel(product.settings.tones, values.tone) },
    { key: 'ending', label: '结局类型', children: choiceLabel(product.settings.endings, values.ending) },
    { key: 'episodes', label: '集数规模', children: `${values.episodeCount ?? '-'} 集` },
    { key: 'language', label: '输出语言', children: choiceLabel(product.settings.languages, values.language) },
  ];
  if (product.visualStyles?.length) items.splice(2, 0, { key: 'visual', label: '视觉风格', children: choiceLabel(product.visualStyles, values.visualStyle) });
  return <Descriptions size="small" column={{ xs: 1, sm: 2 }} items={items} />;
}

function choiceLabel(options: ChoiceOptionDto[], value: unknown) {
  return options.find((item) => item.value === value)?.label ?? String(value ?? '-');
}
