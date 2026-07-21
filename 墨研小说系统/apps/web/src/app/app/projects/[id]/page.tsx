'use client';

import '@ant-design/v5-patch-for-react-19';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Collapse,
  Divider,
  Empty,
  Input,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  EditOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type {
  ArtifactVersionDto,
  GenerationRunDto,
  ProjectDto,
  ProjectStepDto,
  ShortNovelStepKey,
} from '@moyan/contracts';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppHeader } from '../../../../components/AppHeader';
import { ApiError, api, type PromptDto, readableError, session } from '../../../../lib/api';

const stepMeta: Record<ShortNovelStepKey, { title: string; description: string }> = {
  outline: { title: '故事大纲', description: '确定故事核、结构、情感线与反转' },
  characters: { title: '人物小传', description: '建立主要人物、欲望、弱点与关系' },
  chapter_index: { title: '章节目录', description: '把完整故事拆分成五章推进节点' },
  chapter_1: { title: '第一章', description: '快速入戏，建立钩子与核心困境' },
  chapter_2: { title: '第二章', description: '升级冲突，放大人物情绪拉扯' },
  chapter_3: { title: '第三章', description: '推进关键转折，改变局面' },
  chapter_4: { title: '第四章', description: '逼近高潮，集中回收线索' },
  chapter_5: { title: '第五章', description: '完成高潮、反转与情感落点' },
};

const statusMeta: Record<string, { label: string; color: string }> = {
  not_started: { label: '待解锁', color: 'default' },
  available: { label: '可创作', color: 'blue' },
  editing: { label: '编辑中', color: 'cyan' },
  generating: { label: '生成中', color: 'processing' },
  awaiting_confirmation: { label: '待确认', color: 'orange' },
  completed: { label: '已确认', color: 'green' },
  needs_review: { label: '待复核', color: 'gold' },
  failed: { label: '可重试', color: 'red' },
  interrupted: { label: '已中断', color: 'volcano' },
};

const terminalRunStatuses = new Set(['completed', 'failed', 'cancelled', 'interrupted']);

export default function ProjectStudioPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [selectedStep, setSelectedStep] = useState<ShortNovelStepKey>('outline');
  const [prompt, setPrompt] = useState<PromptDto | null>(null);
  const [promptContent, setPromptContent] = useState('');
  const [instruction, setInstruction] = useState('');
  const [run, setRun] = useState<GenerationRunDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      session.clear();
      router.replace('/');
      return;
    }
    messageApi.error(readableError(error));
  }, [messageApi, router]);

  const loadProject = useCallback(async () => {
    try {
      const next = await api.getProject(projectId);
      setProject(next);
      return next;
    } catch (error) {
      handleError(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [handleError, projectId]);

  useEffect(() => {
    if (!session.hasToken()) {
      router.replace('/');
      return;
    }
    void loadProject().then((loaded) => {
      if (loaded) setSelectedStep(loaded.currentStep);
    });
  }, [loadProject, router]);

  useEffect(() => {
    let active = true;
    setPromptLoading(true);
    setRun(null);
    setInstruction('');
    api.getPrompt(projectId, selectedStep)
      .then((next) => {
        if (!active) return;
        setPrompt(next);
        setPromptContent(next.content);
      })
      .catch(handleError)
      .finally(() => active && setPromptLoading(false));
    return () => { active = false; };
  }, [handleError, projectId, selectedStep]);

  const currentStep = useMemo(
    () => project?.steps?.find((step) => step.key === selectedStep) ?? null,
    [project, selectedStep],
  );
  const latestVersion = useMemo(() => {
    const versions = project?.versions?.filter((version) => version.logicalKey === selectedStep) ?? [];
    return versions.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
  }, [project, selectedStep]);
  const generating = Boolean(run && !terminalRunStatuses.has(run.status));
  const canGenerate = Boolean(currentStep && currentStep.status !== 'not_started' && !generating);

  async function savePrompt() {
    setPromptSaving(true);
    try {
      const saved = await api.updatePrompt(projectId, selectedStep, promptContent);
      setPrompt((current) => current ? { ...current, content: saved.content, version: saved.version } : current);
      messageApi.success('补充提示词已保存');
    } catch (error) {
      handleError(error);
    } finally {
      setPromptSaving(false);
    }
  }

  async function generate() {
    if (!canGenerate) return;
    try {
      const created = await api.createRun(projectId, {
        stepKey: selectedStep,
        instruction,
        idempotencyKey: crypto.randomUUID(),
      });
      setRun(created);
      let next = created;
      while (!terminalRunStatuses.has(next.status)) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        next = await api.getRun(created.id);
        setRun(next);
      }
      await loadProject();
      if (next.status === 'completed') messageApi.success('生成完成，请审阅并确认');
      if (next.status === 'failed') messageApi.error(readableRunError(next));
      if (next.status === 'cancelled') messageApi.info('生成任务已停止');
    } catch (error) {
      handleError(error);
      await loadProject();
    }
  }

  async function cancel() {
    if (!run) return;
    try {
      await api.cancelRun(run.id);
      messageApi.info('正在停止生成任务');
    } catch (error) {
      handleError(error);
    }
  }

  async function confirm(version: ArtifactVersionDto) {
    setConfirming(true);
    try {
      const updated = await api.confirmVersion(projectId, selectedStep, version.id);
      setProject(updated);
      setRun(null);
      setSelectedStep(updated.currentStep);
      messageApi.success('本步骤已确认，下一步已解锁');
    } catch (error) {
      handleError(error);
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>;
  }
  if (!project) return null;

  return (
    <div className="app-shell">
      {contextHolder}
      <AppHeader />
      <main className="page-wrap">
        <Breadcrumb
          style={{ marginBottom: 18 }}
          items={[
            { title: <Link href="/app"><ArrowLeftOutlined /> 我的创作</Link> },
            { title: project.title },
          ]}
        />
        <div className="page-heading">
          <div>
            <div className="eyebrow">SHORT NOVEL · FIVE CHAPTERS</div>
            <Typography.Title level={2} style={{ margin: '5px 0' }}>{project.title}</Typography.Title>
            <Space wrap><Tag color="gold">{project.genre}</Tag><Typography.Text type="secondary">{project.tone}</Typography.Text></Space>
          </div>
        </div>

        <div className="studio-grid">
          <aside className="step-sidebar">
            <Card title="创作流程" styles={{ body: { padding: 10 } }}>
              {project.steps?.map((step, index) => (
                <button
                  type="button"
                  className={`step-button ${selectedStep === step.key ? 'active' : ''}`}
                  key={step.key}
                  onClick={() => setSelectedStep(step.key)}
                  aria-current={selectedStep === step.key ? 'step' : undefined}
                >
                  <span className="step-index">
                    {step.status === 'completed' ? <CheckCircleOutlined /> : index + 1}
                  </span>
                  <span style={{ flex: 1 }}>{stepMeta[step.key].title}</span>
                  <Tag color={statusMeta[step.status]?.color} style={{ marginInlineEnd: 0, fontSize: 11 }}>
                    {statusMeta[step.status]?.label ?? step.status}
                  </Tag>
                </button>
              ))}
            </Card>
            <Card size="small" style={{ marginTop: 14 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>故事核心</Typography.Text>
              <Typography.Paragraph ellipsis={{ rows: 4 }} style={{ margin: '7px 0 0' }}>{project.coreIdea}</Typography.Paragraph>
            </Card>
          </aside>

          <section className="studio-content">
            <Card>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space style={{ justifyContent: 'space-between', width: '100%' }} align="start">
                  <div>
                    <Typography.Title level={3} style={{ margin: 0 }}>{stepMeta[selectedStep].title}</Typography.Title>
                    <Typography.Text type="secondary">{stepMeta[selectedStep].description}</Typography.Text>
                  </div>
                  {currentStep && <Tag color={statusMeta[currentStep.status]?.color}>{statusMeta[currentStep.status]?.label}</Tag>}
                </Space>

                {currentStep?.status === 'not_started' && (
                  <Alert style={{ marginTop: 16 }} type="info" showIcon message="该步骤尚未解锁" description="确认上一创作步骤后即可开始生成。你仍可提前查看 Skill 规则和编辑补充提示词。" />
                )}

                <Divider />
                <Typography.Title level={5}><EditOutlined /> 提示词设置</Typography.Title>
                {promptLoading ? <Spin /> : (
                  <>
                    <Collapse
                      ghost
                      items={[{
                        key: 'skill',
                        label: `查看系统 Skill 基线 · ${prompt?.skillVersion ?? ''}`,
                        children: <div className="prompt-base">{prompt?.basePrompt}</div>,
                      }]}
                    />
                    <Typography.Text type="secondary">补充提示词会保存在当前项目、当前步骤中，并随下一次真实模型请求发送。</Typography.Text>
                    <Input.TextArea
                      style={{ marginTop: 10 }}
                      value={promptContent}
                      onChange={(event) => setPromptContent(event.target.value)}
                      rows={4}
                      maxLength={20000}
                      showCount
                      placeholder="例如：加强环境细节；保持第一人称；不要提前揭示反转……"
                    />
                    <Button
                      style={{ marginTop: 10 }}
                      icon={<SaveOutlined />}
                      loading={promptSaving}
                      onClick={savePrompt}
                    >
                      保存补充提示词{prompt?.version ? `（v${prompt.version}）` : ''}
                    </Button>
                  </>
                )}

                <Divider />
                <Typography.Title level={5}>本次生成要求</Typography.Title>
                <Input.TextArea
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  showCount
                  placeholder="只影响本次生成，可以留空"
                  disabled={generating}
                />
                <Space style={{ marginTop: 12 }}>
                  <Button
                    type="primary"
                    size="large"
                    icon={generating ? <LoadingOutlined /> : <PlayCircleOutlined />}
                    loading={generating}
                    disabled={!canGenerate}
                    onClick={generate}
                  >
                    {latestVersion ? '重新生成' : '开始生成'}
                  </Button>
                  {generating && <Button danger icon={<StopOutlined />} onClick={cancel}>停止生成</Button>}
                </Space>

                {run && (
                  <Alert
                    style={{ marginTop: 16 }}
                    type={run.status === 'failed' ? 'error' : run.status === 'completed' ? 'success' : 'info'}
                    showIcon
                    message={runStatusText(run.status)}
                    description={run.status === 'failed' ? readableRunError(run) : undefined}
                  />
                )}

                <Divider />
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Typography.Title level={5} style={{ margin: 0 }}>生成结果</Typography.Title>
                  {latestVersion && <Tag>版本 {latestVersion.version}</Tag>}
                </Space>
                {latestVersion ? (
                  <>
                    <div className="result-paper">{latestVersion.content}</div>
                    {latestVersion.status === 'candidate' && (
                      <Space style={{ marginTop: 16 }}>
                        <Button
                          type="primary"
                          size="large"
                          icon={<CheckCircleOutlined />}
                          loading={confirming}
                          onClick={() => confirm(latestVersion)}
                        >
                          确认并进入下一步
                        </Button>
                        <Typography.Text type="secondary">确认后，下一流程节点才会解锁</Typography.Text>
                      </Space>
                    )}
                    {latestVersion.status === 'confirmed' && (
                      <Alert style={{ marginTop: 16 }} type="success" showIcon message="这是当前已确认版本" />
                    )}
                  </>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本步骤还没有生成内容" />
                )}
              </Space>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}

function runStatusText(status: string) {
  const labels: Record<string, string> = {
    queued: '任务已进入本地执行队列',
    preparing: '正在读取项目上下文与 Skill',
    streaming: 'DeepSeek 正在生成内容',
    validating: '正在校验返回协议',
    repairing: '返回结构不完整，正在自动修复一次',
    completed: '生成完成',
    failed: '生成失败',
    cancelled: '任务已停止',
    interrupted: '任务因服务重启中断',
  };
  return labels[status] ?? status;
}

function readableRunError(run: GenerationRunDto) {
  if (run.errorCode === 'DEEPSEEK_NOT_CONFIGURED') return '服务端尚未配置新的 DeepSeek API Key。';
  if (run.errorCode === 'USER_CANCELLED') return '任务已由用户停止。';
  return run.errorMessage ? `${run.errorMessage}（${run.errorCode ?? 'GENERATION_FAILED'}）` : '生成失败，请稍后重试。';
}
