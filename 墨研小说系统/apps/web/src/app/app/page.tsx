'use client';

import '@ant-design/v5-patch-for-react-19';
import { useEffect, useState } from 'react';
import { Button, Card, Empty, Form, Input, Modal, Select, Space, Spin, Tag, Typography, message } from 'antd';
import { ArrowRightOutlined, PlusOutlined } from '@ant-design/icons';
import type { ProjectDto } from '@moyan/contracts';
import { useRouter } from 'next/navigation';
import { AppHeader } from '../../components/AppHeader';
import { ApiError, api, readableError, session } from '../../lib/api';

const genres = ['现代言情', '古代权谋', '悬疑推理', '都市职场', '奇幻玄幻', '科幻未来', '武侠江湖', '历史架空'];

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!session.hasToken()) {
      router.replace('/');
      return;
    }
    void load();
  }, [router]);

  async function load() {
    try {
      setProjects(await api.listProjects());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        session.clear();
        router.replace('/');
      } else {
        messageApi.error(readableError(error));
      }
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    try {
      const values = await form.validateFields();
      setCreating(true);
      const project = await api.createProject(values);
      setOpen(false);
      form.resetFields();
      router.push(`/app/projects/${project.id}`);
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) return;
      messageApi.error(readableError(error));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="app-shell">
      {contextHolder}
      <AppHeader />
      <main className="page-wrap">
        <div className="page-heading">
          <div>
            <div className="eyebrow">MY STORIES</div>
            <Typography.Title level={2} style={{ margin: '6px 0 0' }}>我的创作</Typography.Title>
            <Typography.Text type="secondary">每个项目都按照已确认的步骤向前推进</Typography.Text>
          </div>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setOpen(true)}>新建小说</Button>
        </div>

        {loading ? (
          <div style={{ padding: 100, textAlign: 'center' }}><Spin size="large" /></div>
        ) : projects.length === 0 ? (
          <Card style={{ padding: 55, textAlign: 'center', borderColor: 'var(--line)' }}>
            <Empty description="还没有小说项目">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>创建第一部小说</Button>
            </Empty>
          </Card>
        ) : (
          <div className="project-grid">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="project-card"
                hoverable
                onClick={() => router.push(`/app/projects/${project.id}`)}
              >
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <Space><Tag color="gold">{project.genre}</Tag><Typography.Text type="secondary">五章短篇</Typography.Text></Space>
                  <Typography.Title level={3} style={{ margin: 0 }}>{project.title}</Typography.Title>
                  <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ minHeight: 44, margin: 0 }}>
                    {project.coreIdea}
                  </Typography.Paragraph>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      更新于 {new Date(project.updatedAt).toLocaleDateString('zh-CN')}
                    </Typography.Text>
                    <Button type="text" icon={<ArrowRightOutlined />}>继续创作</Button>
                  </Space>
                </Space>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Modal
        title="创建五章短篇小说"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={createProject}
        okText="创建并进入工作台"
        cancelText="取消"
        confirmLoading={creating}
        width={660}
      >
        <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 22 }}>
          <div className="brief-grid">
            <Form.Item name="title" label="暂定书名" rules={[{ required: true, message: '请输入书名' }, { max: 100 }]}>
              <Input placeholder="可以在创作后再调整" />
            </Form.Item>
            <Form.Item name="genre" label="故事题材" rules={[{ required: true, message: '请选择题材' }]}>
              <Select placeholder="选择题材" options={genres.map((value) => ({ value, label: value }))} />
            </Form.Item>
          </div>
          <Form.Item name="coreIdea" label="故事核心" rules={[{ required: true, message: '请描述故事核心' }, { min: 10, message: '至少输入 10 个字' }]}>
            <Input.TextArea rows={3} maxLength={2000} showCount placeholder="这是谁的故事？最吸引人的设定是什么？" />
          </Form.Item>
          <Form.Item name="coreConflict" label="核心冲突" rules={[{ required: true, message: '请描述核心冲突' }, { min: 10, message: '至少输入 10 个字' }]}>
            <Input.TextArea rows={3} maxLength={2000} showCount placeholder="人物想得到什么？最大的阻碍和代价是什么？" />
          </Form.Item>
          <Form.Item name="tone" label="叙事基调" rules={[{ required: true, message: '请输入叙事基调' }, { min: 2 }]}>
            <Input placeholder="例如：克制、紧张、温暖治愈" maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
