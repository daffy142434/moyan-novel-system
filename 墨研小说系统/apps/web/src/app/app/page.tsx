'use client';

import '@ant-design/v5-patch-for-react-19';
import { ArrowRightOutlined, BookOutlined, FileDoneOutlined, ThunderboltOutlined, WalletOutlined } from '@ant-design/icons';
import { Button, Card, Col, Empty, Progress, Row, Space, Spin, Statistic, Tag, Typography, message } from 'antd';
import type { DashboardDto } from '@moyan/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/AppShell';
import { api, readableError, session } from '../../lib/api';

export default function HomeDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!session.hasToken()) { router.replace('/'); return; }
    api.dashboard().then(setData).catch((error) => messageApi.error(readableError(error))).finally(() => setLoading(false));
  }, [messageApi, router]);

  if (loading) return <div className="center-screen"><Spin size="large" /></div>;
  if (!data) return null;
  const completion = data.totalEpisodes ? Math.round(data.completedEpisodes / data.totalEpisodes * 100) : 0;
  return (
    <AppShell>
      {contextHolder}
        <div className="page-heading">
          <div><div className="eyebrow">CREATOR OVERVIEW</div><Typography.Title level={2}>创作首页</Typography.Title><Typography.Text type="secondary">查看作品进度、会员状态与本月模型消耗</Typography.Text></div>
          <Link href="/app/workbench"><Button type="primary" size="large" icon={<ThunderboltOutlined />}>开始新创作</Button></Link>
        </div>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}><Card><Statistic title="作品总数" value={data.projectCount} prefix={<BookOutlined />} /></Card></Col>
          <Col xs={24} sm={12} xl={6}><Card><Statistic title="创作中" value={(data.statusCounts.building ?? 0) + (data.statusCounts.writing ?? 0)} prefix={<ThunderboltOutlined />} /></Card></Col>
          <Col xs={24} sm={12} xl={6}><Card><Statistic title="已完成分集" value={data.completedEpisodes} suffix={`/ ${data.totalEpisodes}`} prefix={<FileDoneOutlined />} /></Card></Col>
          <Col xs={24} sm={12} xl={6}><Card><Statistic title="积分余额" value={data.membership.creditBalance} precision={2} prefix={<WalletOutlined />} /><Tag color="gold">{data.membership.plan.toUpperCase()}</Tag></Card></Col>
        </Row>
        <Row gutter={[18, 18]} style={{ marginTop: 18 }}>
          <Col xs={24} lg={16}>
            <Card title="最近创作" extra={<Link href="/app/library">查看全部 <ArrowRightOutlined /></Link>}>
              {data.recentProjects.length ? <div className="recent-list">{data.recentProjects.map((project) => (
                <Link className="recent-item" href={`/app/stories/${project.id}`} key={project.id}>
                  <div><Typography.Text strong>{project.title}</Typography.Text><div><Tag>{project.genre || '未分类'}</Tag><Typography.Text type="secondary">{statusText(project.lifecycleStatus)}</Typography.Text></div></div><ArrowRightOutlined />
                </Link>
              ))}</div> : <Empty description="还没有作品" />}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="本月使用情况">
              <Space direction="vertical" size={18} style={{ width: '100%' }}>
                <div><Typography.Text type="secondary">分集完成率</Typography.Text><Progress percent={completion} /></div>
                <Statistic title="输入 Token" value={data.usage.inputTokens} />
                <Statistic title="输出 Token" value={data.usage.outputTokens} />
                <Statistic title="本月积分消耗" value={data.usage.credits} precision={4} />
              </Space>
            </Card>
          </Col>
        </Row>
    </AppShell>
  );
}

function statusText(status: string) {
  return ({ building: '构建中', ready_to_write: '待编写', writing: '编写中', completed: '已完成', archived: '已归档' } as Record<string, string>)[status] ?? status;
}
