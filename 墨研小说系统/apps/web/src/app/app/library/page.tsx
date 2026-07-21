'use client';

import '@ant-design/v5-patch-for-react-19';
import { ArrowRightOutlined, BookOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Input, Popconfirm, Progress, Select, Space, Spin, Tag, Typography, message } from 'antd';
import type { StudioProjectDto } from '@moyan/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../../components/AppShell';
import { api, readableError, session } from '../../../lib/api';

export default function LibraryPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<StudioProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [deletingId, setDeletingId] = useState('');
  const [messageApi, contextHolder] = message.useMessage();
  useEffect(() => {
    if (!session.hasToken()) { router.replace('/'); return; }
    api.studioProjects().then(setProjects).catch((error) => messageApi.error(readableError(error))).finally(() => setLoading(false));
  }, [messageApi, router]);
  const filtered = useMemo(
    () => projects.filter((project) =>
      (!query || project.title.toLowerCase().includes(query.toLowerCase()))
      && (status === 'all' || project.lifecycleStatus === status)),
    [projects, query, status],
  );
  async function deleteProject(project: StudioProjectDto) {
    setDeletingId(project.id);
    try {
      await api.deleteStudioProject(project.id);
      setProjects((items) => items.filter((item) => item.id !== project.id));
      messageApi.success(`《${project.title}》已删除`);
    } catch (error) {
      messageApi.error(readableError(error));
    } finally {
      setDeletingId('');
    }
  }
  return <AppShell>{contextHolder}
    <div className="page-heading"><div><div className="eyebrow">STORY LIBRARY</div><Typography.Title level={2}>小说集</Typography.Title><Typography.Text type="secondary">查看构建资料、分集进度和历史作品</Typography.Text></div><Link href="/app/workbench"><Button type="primary" size="large" icon={<PlusOutlined />}>创建新作品</Button></Link></div>
    <Card className="filter-bar"><Space wrap><Input.Search value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索作品标题" allowClear style={{ width: 280 }} /><Select value={status} onChange={setStatus} style={{ width: 150 }} options={[{ value: 'all', label: '全部状态' }, { value: 'building', label: '构建中' }, { value: 'ready_to_write', label: '待编写' }, { value: 'writing', label: '编写中' }, { value: 'completed', label: '已完成' }]} /></Space></Card>
    {loading ? <div className="center-block"><Spin size="large" /></div> : filtered.length ? <div className="project-grid library-grid">{filtered.map((project) => {
      const completed = project.episodes.filter((episode) => episode.status === 'confirmed').length;
      const percent = project.episodes.length ? Math.round(completed / project.episodes.length * 100) : 0;
      const href = `/app/stories/${project.id}`;
      return <Card key={project.id} className="project-card" hoverable><Space direction="vertical" size={13} style={{ width: '100%' }}>
        <Space wrap><Tag color="gold">{productLabel(project.productType)}</Tag><Tag>{statusLabel(project.lifecycleStatus)}</Tag></Space>
        <Link href={href}><Typography.Title level={3} style={{ margin: 0 }}>{project.title}</Typography.Title></Link>
        <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ minHeight: 44, margin: 0 }}>{project.synopsis || project.genre || '等待完善作品信息'}</Typography.Paragraph>
        {project.episodes.length ? <div><Space style={{ justifyContent: 'space-between', width: '100%' }}><Typography.Text type="secondary">已完成 {completed}/{project.episodes.length} 集</Typography.Text><Typography.Text>{percent}%</Typography.Text></Space><Progress percent={percent} showInfo={false} /></div> : <Typography.Text type="secondary"><BookOutlined /> 构建资料准备中</Typography.Text>}
        <Space style={{ justifyContent: 'space-between', width: '100%' }}><Typography.Text type="secondary">{new Date(project.updatedAt).toLocaleDateString('zh-CN')}</Typography.Text><Space><Link href={href}><Button type="text">继续创作 <ArrowRightOutlined /></Button></Link><Popconfirm title={`确认删除《${project.title}》？`} description="作品、构建资料、正文和标注将永久删除，无法恢复。" okText="永久删除" cancelText="取消" okButtonProps={{ danger: true, loading: deletingId === project.id }} onConfirm={() => deleteProject(project)}><Button type="text" danger icon={<DeleteOutlined />} loading={deletingId === project.id}>删除</Button></Popconfirm></Space></Space>
      </Space></Card>;
    })}</div> : <Empty description="没有匹配的作品" />}
  </AppShell>;
}

function productLabel(type: string) { return ({ short_drama: '短剧', comic_drama: '漫剧' } as Record<string, string>)[type] ?? type; }
function statusLabel(value: string) { return ({ building: '待构建', ready_to_write: '已构建待编写', writing: '编写中', completed: '已完成', archived: '已归档' } as Record<string, string>)[value] ?? value; }
