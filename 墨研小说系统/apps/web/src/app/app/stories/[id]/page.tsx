'use client';

import '@ant-design/v5-patch-for-react-19';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileSearchOutlined,
  HighlightOutlined,
  LockOutlined,
  MessageOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Input,
  Layout,
  List,
  Menu,
  Modal,
  Progress,
  Space,
  Spin,
  Steps,
  Tag,
  Typography,
  message,
} from 'antd';
import type { BuildArtifactDto, BuildStageKey, EpisodeAnnotationDto, EpisodeDto, StudioGenerationRunDto, StudioProjectDto } from '@moyan/contracts';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '../../../../components/AppShell';
import { GenerationStreamDrawer } from '../../../../components/GenerationStreamDrawer';
import ModelPromptSelector from '../../../../components/ModelPromptSelector';
import { api, readableError, session, streamStudioGeneration } from '../../../../lib/api';

const buildMeta: Record<BuildStageKey, { title: string; description: string }> = {
  outline: { title: '故事大纲', description: '起承转合结构、核心冲突、结局与推荐标题' },
  proposal: { title: '创作方案', description: '故事核心、结构、节奏、结局与推荐标题' },
  characters: { title: '角色开发', description: '角色信息、关系、弧线与视觉锚点' },
  catalog: { title: '目录大纲', description: '逐集冲突、爽点、付费卡点与衔接' },
};

export default function StoryStudioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<StudioProjectDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [modal, modalContext] = Modal.useModal();
  useEffect(() => {
    if (!session.hasToken()) { router.replace('/'); return; }
    api.studioProject(id).then(setProject).catch((error) => messageApi.error(readableError(error))).finally(() => setLoading(false));
  }, [id, messageApi, router]);
  if (loading) return <div className="center-screen"><Spin size="large" /></div>;
  if (!project) return null;
  function requestDelete() {
    if (!project) return;
    modal.confirm({
      title: `确认删除《${project.title}》？`,
      content: '作品、构建资料、全部正文和标注将永久删除，无法恢复。',
      okText: '永久删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setDeleting(true);
        try {
          await api.deleteStudioProject(project.id);
          router.replace('/app/library');
        } catch (error) {
          messageApi.error(readableError(error));
          throw error;
        } finally {
          setDeleting(false);
        }
      },
    });
  }
  return <AppShell>{contextHolder}{modalContext}
    <Breadcrumb style={{ marginBottom: 18 }} items={[{ title: <Link href="/app/library"><ArrowLeftOutlined /> 小说集</Link> }, { title: project.title }]} />
    <div className="story-heading"><div><Space wrap><Tag color="blue">{project.productType === 'comic_drama' ? 'AI 漫剧' : '短剧'}</Tag><Tag>{modeLabel(project.productionMode)}</Tag><Tag>{project.genre}</Tag></Space><Typography.Title level={2}>{project.title}</Typography.Title><Typography.Paragraph type="secondary">{project.synopsis}</Typography.Paragraph></div><Space direction="vertical" align="end"><Tag color={project.constructionLocked ? 'green' : 'processing'}>{project.constructionLocked ? '已构建' : '构建中'}</Tag><Button type="text" danger icon={<DeleteOutlined />} loading={deleting} onClick={requestDelete}>删除小说</Button></Space></div>
    {project.constructionLocked
      ? <EpisodeWorkspace project={project} onChange={setProject} notify={messageApi} />
      : <BuildWorkspace project={project} onChange={setProject} notify={messageApi} />}
  </AppShell>;
}

function BuildWorkspace({ project, onChange, notify }: { project: StudioProjectDto; onChange: (project: StudioProjectDto) => void; notify: ReturnType<typeof message.useMessage>[0] }) {
  const initial = project.buildArtifacts.find((item) => item.status === 'available' || item.status === 'candidate')?.stage ?? 'proposal';
  const [stage, setStage] = useState<BuildStageKey>(initial);
  const artifact = project.buildArtifacts.find((item) => item.stage === stage) ?? null;
  const [content, setContent] = useState(artifact?.content ?? '');
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamRun, setStreamRun] = useState<StudioGenerationRunDto | null>(null);
  const [streamOpen, setStreamOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);
  const [modal, modalContext] = Modal.useModal();
  useEffect(() => { setContent(artifact?.content ?? ''); setInstruction(''); }, [artifact?.content, artifact?.id]);
  async function act(work: () => Promise<StudioProjectDto>, success: string) {
    setBusy(true);
    try { const next = await work(); onChange(next); notify.success(success); return next; }
    catch (error) { notify.error(readableError(error)); return null; }
    finally { setBusy(false); }
  }
  async function generate() {
    if (!artifact || artifact.status === 'locked') return;
    setBusy(true); setStreamRun(null); setStreamOpen(true);
    try {
      const run = await streamStudioGeneration({ scope: 'build', projectId: project.id, stage, instruction, modelId: selectedModel }, setStreamRun);
      if (run.status === 'completed') {
        const next = run.result as StudioProjectDto;
        onChange(next);
        notify.success(`${buildMeta[stage].title}已生成，请审阅和编辑`);
      }
    } catch (error) { notify.error(readableError(error)); }
    finally { setBusy(false); }
  }
  function save() { void act(() => api.saveBuild(project.id, stage, content), '修改已保存'); }
  function confirm() {
    modal.confirm({ title: `确认${buildMeta[stage].title}？`, content: stage === 'catalog' ? '确认目录后作品构建将冻结，并创建全部分集。此操作不可回退。' : '确认后将解锁下一构建阶段。', okText: '确认并继续', onOk: async () => {
      const next = await act(() => api.confirmBuild(project.id, stage), stage === 'catalog' ? '构建完成，已进入分集创作' : '已确认并解锁下一步');
      if (next && stage === 'proposal') setStage('characters');
      if (next && stage === 'characters') setStage('catalog');
    } });
  }
  function showContext(title: string, detail: string) {
    modal.info({ title, width: 820, content: <div className="context-detail">{detail}</div>, okText: '关闭' });
  }
  function stopGeneration() { if (streamRun) void api.cancelStudioGeneration(streamRun.id); }
  function rewind(target: BuildStageKey) {
    modal.confirm({ title: `回退到${buildMeta[target].title}？`, content: '该步骤之后的内容会被清除，此操作不可撤销。', okType: 'danger', okText: '确认回退', onOk: () => act(() => api.rewindBuild(project.id, target), '已回退，后续内容已清除') });
  }
  const currentStage = project.buildArtifacts.findIndex((item) => item.stage === stage);
  return <Layout className="studio-layout">{modalContext}<Layout.Sider theme="light" width={280} className="step-sidebar"><Card title="小说构建" styles={{ body: { padding: 16 } }}><Steps direction="vertical" current={currentStage} onChange={(index) => setStage(project.buildArtifacts[index].stage)} items={project.buildArtifacts.map((item) => ({ title: buildMeta[item.stage].title, description: <Tag color={buildStatusColor(item.status)}>{buildStatusLabel(item.status)}</Tag>, status: item.status === 'confirmed' ? 'finish' : item.stage === stage ? 'process' : 'wait', icon: item.status === 'locked' ? <LockOutlined /> : undefined }))} /></Card></Layout.Sider>
    <Layout.Content className="studio-content"><Card><Space direction="vertical" size={15} style={{ width: '100%' }}><Space style={{ justifyContent: 'space-between', width: '100%' }} align="start"><div><Typography.Title level={3}>{buildMeta[stage].title}</Typography.Title><Typography.Text type="secondary">{buildMeta[stage].description}</Typography.Text></div>{artifact && <Tag color={buildStatusColor(artifact.status)}>{buildStatusLabel(artifact.status)}</Tag>}</Space>
      <BuildContextSummary project={project} stage={stage} onView={showContext} />
      {artifact?.status === 'locked' ? <Alert type="info" showIcon message="该步骤尚未解锁" description="请先确认上一个构建步骤。" /> : <><Typography.Text strong><MessageOutlined /> 本次生成或调整要求</Typography.Text><Input.TextArea rows={3} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="例如：强化女主的主动性；增加第10集付费卡点……" disabled={busy} /><Space wrap><Button type="primary" icon={artifact?.content ? <ReloadOutlined /> : <PlayCircleOutlined />} loading={busy} onClick={() => { pendingAction.current = () => { void generate(); }; setSelectorOpen(true); }}>{artifact?.content ? '重新生成' : '开始生成'}</Button>{artifact?.content && <Button icon={<SaveOutlined />} disabled={busy} loading={busy} onClick={save}>保存修改</Button>}{artifact?.status === 'confirmed' && stage !== 'catalog' && <Button danger disabled={busy} onClick={() => rewind(stage)}>回退到本步骤</Button>}</Space></>}
      {artifact?.content && <><Divider /><Typography.Title level={5}>构建文档</Typography.Title><Input.TextArea className="build-editor" rows={26} value={content} onChange={(event) => setContent(event.target.value)} readOnly={artifact.status === 'locked' || busy} /></>}
      {artifact?.content && artifact.status !== 'locked' && <Space><Button type="primary" size="large" icon={<CheckCircleOutlined />} loading={busy} onClick={confirm}>确认{stage === 'catalog' ? '并开始分集创作' : '并进入下一步'}</Button><Typography.Text type="secondary">版本 v{artifact.version}</Typography.Text></Space>}
    </Space></Card></Layout.Content><GenerationStreamDrawer open={streamOpen} title={`正在生成${buildMeta[stage].title}`} run={streamRun} onStop={stopGeneration} onClose={() => setStreamOpen(false)} />
  <ModelPromptSelector open={selectorOpen} scope={stage} onCancel={() => setSelectorOpen(false)} onStart={(opts) => { setSelectorOpen(false); setSelectedModel(opts.modelId || ''); pendingAction.current?.(); }} />
  </Layout>;
}

function EpisodeWorkspace({ project, onChange, notify }: { project: StudioProjectDto; onChange: (project: StudioProjectDto) => void; notify: ReturnType<typeof message.useMessage>[0] }) {
  const firstAvailable = project.episodes.find((item) => item.status !== 'locked')?.number ?? 1;
  const [selected, setSelected] = useState<number | 'catalog'>(firstAvailable);
  const episode = typeof selected === 'number' ? project.episodes.find((item) => item.number === selected) ?? null : null;
  const [content, setContent] = useState(episode?.content ?? '');
  const [editing, setEditing] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamRun, setStreamRun] = useState<StudioGenerationRunDto | null>(null);
  const [streamOpen, setStreamOpen] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0, text: '' });
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [annotationNote, setAnnotationNote] = useState('');
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [optimizedContent, setOptimizedContent] = useState('');
  const [optimizedSummary, setOptimizedSummary] = useState('');
  const [modal, modalContext] = Modal.useModal();
  useEffect(() => { setContent(episode?.content ?? ''); setEditing(false); setInstruction(''); }, [episode?.id, episode?.content]);
  async function act(work: () => Promise<StudioProjectDto>, success: string) {
    setBusy(true);
    try { const next = await work(); onChange(next); notify.success(success); }
    catch (error) { notify.error(readableError(error)); }
    finally { setBusy(false); }
  }
  if (selected === 'catalog') {
    const catalog = project.buildArtifacts.find((item) => item.stage === 'catalog');
    return <Layout className="episode-layout">{modalContext}<EpisodeSidebar project={project} selected={selected} onSelect={setSelected} /><Layout.Content><Card><Typography.Title level={3}>大纲目录</Typography.Title><Alert type="success" showIcon message="构建资料已经冻结" description="目录确认后不可修改，分集创作将以此为权威上下文。" /><div className="result-paper" style={{ marginTop: 16 }}>{catalog?.content}</div></Card></Layout.Content></Layout>;
  }
  if (!episode) return null;
  const episodeNumber = episode.number;
  const hadContent = Boolean(episode.content);
  const reportCurrent = episode.latestReview?.contentVersion === episode.contentVersion;
  const canConfirm = reportCurrent && (episode.latestReview?.score ?? 0) >= 90;
  function captureSelection(event: React.SyntheticEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget;
    setSelection({ start: target.selectionStart, end: target.selectionEnd, text: target.value.slice(target.selectionStart, target.selectionEnd) });
  }
  async function addAnnotation() {
    if (!selection.text || !annotationNote.trim()) return;
    await act(() => api.addAnnotation(project.id, episodeNumber, { startOffset: selection.start, endOffset: selection.end, quotedText: selection.text, note: annotationNote }), '标注已保存');
    setAnnotationOpen(false); setAnnotationNote('');
  }
  async function runAi(scope: 'episode_generate' | 'episode_optimize' | 'episode_review') {
    setBusy(true); setStreamRun(null); setStreamOpen(true);
    try {
      const run = await streamStudioGeneration({ scope, projectId: project.id, episodeNumber, instruction }, setStreamRun);
      if (run.status !== 'completed') return;
      if (scope === 'episode_optimize') {
        const result = run.result as { content: string; summary: string };
        setOptimizedContent(result.content); setOptimizedSummary(result.summary); setOptimizeOpen(true);
        notify.success('AI 优化完成，请确认结果');
      } else {
        const next = run.result as StudioProjectDto;
        onChange(next);
        notify.success(scope === 'episode_review' ? '自检完成' : hadContent ? '本集已重新生成，原标注已清空' : '本集正文已生成');
      }
    } catch (error) { notify.error(readableError(error)); }
    finally { setBusy(false); }
  }
  function stopGeneration() { if (streamRun) void api.cancelStudioGeneration(streamRun.id); }
  function confirmEpisode() {
    modal.confirm({ title: `确认第 ${episodeNumber} 集？`, content: '确认后本集完成并解锁下一集。', okText: '确认完成', onOk: () => act(() => api.confirmEpisode(project.id, episodeNumber), '本集已确认，下一集已解锁') });
  }
  return <Layout className="episode-layout">{modalContext}<EpisodeSidebar project={project} selected={selected} onSelect={setSelected} /><Layout.Content className="episode-main"><Card><Space direction="vertical" size={14} style={{ width: '100%' }}>
    <Space style={{ justifyContent: 'space-between', width: '100%' }} align="start"><div><div className="eyebrow">EPISODE {episode.number}</div><Typography.Title level={3}>{episode.title || `第${episode.number}集`}</Typography.Title></div><Tag color={episodeStatusColor(episode.status)}>{episodeStatusLabel(episode.status)}</Tag></Space>
    <Card size="small" className="episode-outline"><Typography.Text strong>本集目录要点</Typography.Text><Typography.Paragraph style={{ margin: '8px 0 0' }}>{episode.outlineSummary || '目录中暂未解析到本集摘要，请以大纲目录为准。'}</Typography.Paragraph></Card>
    {episode.latestReview && <Card size="small" className={reportCurrent ? 'review-card' : 'review-card stale'}><Space style={{ justifyContent: 'space-between', width: '100%' }}><div><Typography.Text strong>最新自检：{episode.latestReview.score} 分</Typography.Text><Typography.Paragraph type="secondary" style={{ margin: '5px 0 0' }}>{reportCurrent ? episode.latestReview.summary : '正文已修改，本报告已失效，请重新自检。'}</Typography.Paragraph></div><Progress type="circle" size={64} percent={episode.latestReview.score} strokeColor={episode.latestReview.score >= 90 ? '#52c41a' : '#faad14'} /></Space>{reportCurrent && episode.latestReview.suggestions.length > 0 && <List size="small" header="主要修改建议" dataSource={episode.latestReview.suggestions} renderItem={(item) => <List.Item>{item}</List.Item>} />}</Card>}
    {episode.status === 'locked' && <Alert type="info" showIcon message="本集尚未解锁" description="请先完成并确认上一集。" />}
    {!episode.content && episode.status !== 'locked' ? <Empty description="正文尚未生成"><Button type="primary" size="large" icon={<PlayCircleOutlined />} loading={busy} onClick={() => void runAi('episode_generate')}>开始创作</Button></Empty> : episode.content ? <>
      <Input.TextArea rows={3} value={instruction} disabled={busy} onChange={(event) => setInstruction(event.target.value)} placeholder="本次重新生成或 AI 优化要求" />
      <Space wrap className="episode-toolbar"><Button icon={<EditOutlined />} disabled={busy} type={editing ? 'primary' : 'default'} onClick={() => setEditing((value) => !value)}>{editing ? '退出编辑' : '修改正文'}</Button>{editing && <Button icon={<SaveOutlined />} disabled={busy} loading={busy} onClick={() => act(() => api.saveEpisode(project.id, episode.number, content, episode.title), '正文已保存，请重新自检')}>保存修改</Button>}<Button icon={<HighlightOutlined />} disabled={busy || !editing || !selection.text} onClick={() => setAnnotationOpen(true)}>标注选中文字</Button><Button icon={<MessageOutlined />} disabled={busy} loading={busy} onClick={() => void runAi('episode_optimize')}>AI 优化</Button><Button icon={<FileSearchOutlined />} disabled={busy} loading={busy} onClick={() => void runAi('episode_review')}>自检</Button><Button icon={<ReloadOutlined />} disabled={busy} loading={busy} onClick={() => void runAi('episode_generate')}>重新生成</Button></Space>
      {editing
        ? <Input.TextArea className="episode-editor" rows={28} value={content} disabled={busy} onSelect={captureSelection} onChange={(event) => setContent(event.target.value)} />
        : <AnnotatedContent content={content} annotations={episode.annotations} onOpen={(annotation) => modal.info({ title: '正文标注', content: <><Typography.Paragraph className="annotation-quote">{annotation.quotedText}</Typography.Paragraph><Typography.Paragraph>{annotation.note}</Typography.Paragraph></> })} />}
      {episode.annotations.length > 0 && <Card size="small" title={`正文标注（${episode.annotations.length}）`}><List dataSource={episode.annotations} renderItem={(item) => <List.Item actions={[<Button type="link" danger disabled={busy} key="delete" onClick={() => act(() => api.deleteAnnotation(project.id, episode.number, item.id), '标注已删除')}>删除</Button>]}><List.Item.Meta title={`“${item.quotedText.slice(0, 80)}”`} description={item.note} /></List.Item>} /></Card>}
      <Divider /><Space><Button type="primary" size="large" icon={<CheckCircleOutlined />} disabled={busy || !canConfirm} onClick={confirmEpisode}>确认本集并解锁下一集</Button>{!reportCurrent && <Typography.Text type="secondary">需要对当前正文执行自检</Typography.Text>}{reportCurrent && !canConfirm && <Typography.Text type="danger">自检需达到 90 分</Typography.Text>}</Space>
    </> : null}
  </Space></Card></Layout.Content>
  <Modal title="添加正文标注" open={annotationOpen} onCancel={() => !busy && setAnnotationOpen(false)} onOk={addAnnotation} okButtonProps={{ disabled: busy }} cancelButtonProps={{ disabled: busy }} okText="保存标注"><Typography.Paragraph className="annotation-quote">{selection.text}</Typography.Paragraph><Input.TextArea rows={4} disabled={busy} value={annotationNote} onChange={(event) => setAnnotationNote(event.target.value)} placeholder="说明这里需要怎样修改" /></Modal>
  <Drawer title="AI 优化差异确认" width={720} open={optimizeOpen} onClose={() => !busy && setOptimizeOpen(false)} extra={<Button type="primary" disabled={busy} onClick={() => { void act(() => api.saveEpisode(project.id, episode.number, optimizedContent, episode.title), 'AI 优化结果已应用，请重新自检'); setOptimizeOpen(false); }}>应用到正文</Button>}><Alert type="info" showIcon message={optimizedSummary || '模型已根据标注和补充要求完成优化'} /><Typography.Title level={5}>优化后正文</Typography.Title><Input.TextArea rows={30} disabled={busy} value={optimizedContent} onChange={(event) => setOptimizedContent(event.target.value)} /></Drawer>
  <GenerationStreamDrawer open={streamOpen} title="模型正在处理" run={streamRun} onStop={stopGeneration} onClose={() => setStreamOpen(false)} />
  </Layout>;
}

function BuildContextSummary({ project, stage, onView }: { project: StudioProjectDto; stage: BuildStageKey; onView: (title: string, detail: string) => void }) {
  const proposal = project.buildArtifacts.find((item) => item.stage === 'proposal');
  const characters = project.buildArtifacts.find((item) => item.stage === 'characters');
  const items = [
    { key: 'mode', label: '制作模式', children: modeLabel(project.productionMode) },
    { key: 'genre', label: '题材', children: project.genre },
    { key: 'channel', label: '频道', children: channelLabel(project.audience) },
    { key: 'tone', label: '基调', children: project.tone },
    { key: 'ending', label: '结局', children: project.endingType },
    { key: 'episodes', label: '集数', children: `${project.episodeCount} 集` },
  ];
  return <Card size="small" title="已确认上下文" extra={<Button type="link" onClick={() => onView('创作设定详情', formatProjectSettings(project))}>查看完整设定</Button>}>
    <Descriptions size="small" column={{ xs: 1, md: 3 }} items={items} />
    {(stage === 'characters' || stage === 'catalog') && proposal?.content && <ContextArtifact title="创作方案" artifact={proposal} onView={onView} />}
    {stage === 'catalog' && characters?.content && <ContextArtifact title="角色开发" artifact={characters} onView={onView} />}
  </Card>;
}

function ContextArtifact({ title, artifact, onView }: { title: string; artifact: BuildArtifactDto; onView: (title: string, detail: string) => void }) {
  return <div className="context-summary"><div><Typography.Text strong>{title}</Typography.Text><Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: '4px 0 0' }}>{artifact.summary || artifact.content.slice(0, 160)}</Typography.Paragraph></div><Button type="link" onClick={() => onView(title, artifact.content)}>查看详情</Button></div>;
}

function AnnotatedContent({ content, annotations, onOpen }: { content: string; annotations: EpisodeAnnotationDto[]; onOpen: (annotation: EpisodeAnnotationDto) => void }) {
  const sorted = [...annotations].sort((a, b) => a.startOffset - b.startOffset);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const annotation of sorted) {
    if (annotation.startOffset < cursor || annotation.endOffset > content.length) continue;
    nodes.push(content.slice(cursor, annotation.startOffset));
    nodes.push(<button type="button" className="inline-annotation" key={annotation.id} onClick={() => onOpen(annotation)}>{content.slice(annotation.startOffset, annotation.endOffset)}<sup>标注</sup></button>);
    cursor = annotation.endOffset;
  }
  nodes.push(content.slice(cursor));
  return <div className="episode-reading">{nodes}</div>;
}

function EpisodeSidebar({ project, selected, onSelect }: { project: StudioProjectDto; selected: number | 'catalog'; onSelect: (value: number | 'catalog') => void }) {
  const selectedKey = selected === 'catalog' ? 'catalog' : `episode-${selected}`;
  return <Layout.Sider theme="light" width={270} className="episode-sidebar"><Card title="分集目录" styles={{ body: { padding: 0 } }}><Menu mode="inline" selectedKeys={[selectedKey]} onClick={({ key }) => onSelect(key === 'catalog' ? 'catalog' : Number(key.replace('episode-', '')))} items={[{ key: 'catalog', icon: <FileSearchOutlined />, label: '大纲目录' }, ...project.episodes.map((episode) => ({ key: `episode-${episode.number}`, icon: episode.status === 'locked' ? <LockOutlined /> : episode.status === 'confirmed' ? <CheckCircleOutlined /> : <span>{episode.number}</span>, label: episode.title || `第${episode.number}集`, disabled: episode.status === 'locked' }))]} /></Card></Layout.Sider>;
}

function buildStatusLabel(status: BuildArtifactDto['status']) { return ({ available: '可创作', candidate: '待确认', confirmed: '已确认', locked: '待解锁' } as const)[status]; }
function buildStatusColor(status: BuildArtifactDto['status']) { return ({ available: 'blue', candidate: 'orange', confirmed: 'green', locked: 'default' } as const)[status]; }
function episodeStatusLabel(status: EpisodeDto['status']) { return ({ locked: '待解锁', available: '可创作', draft: '草稿', review_required: '待确认', confirmed: '已完成' } as const)[status]; }
function episodeStatusColor(status: EpisodeDto['status']) { return ({ locked: 'default', available: 'blue', draft: 'cyan', review_required: 'orange', confirmed: 'green' } as const)[status]; }
function channelLabel(channel: string) { return ({ male: '男频', female: '女频', all: '全年龄' } as Record<string, string>)[channel] ?? channel; }
function modeLabel(mode: string) { return ({ domestic: '国内下沉剧', overseas_live: '海外仿真人原创', overseas_ai: '海外 AI 剧本', overseas: '海外原创漫剧' } as Record<string, string>)[mode] ?? mode; }
function formatProjectSettings(project: StudioProjectDto) {
  const special = String(project.settings.specialRequirements ?? '无');
  return [`制作模式：${modeLabel(project.productionMode)}`, `题材：${project.genre}`, `频道：${channelLabel(project.audience)}`, `故事基调：${project.tone}`, `结局类型：${project.endingType}`, `集数：${project.episodeCount} 集`, `语言：${project.language}`, `特殊要求：${special}`].join('\n');
}
