'use client';

import '@ant-design/v5-patch-for-react-19';
import { CloudUploadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Space, Steps, Typography } from 'antd';
import { AppShell } from '../../../components/AppShell';

export default function PublishPage() {
  return <AppShell narrow><div className="eyebrow">SUBMISSION & PUBLISHING</div><Typography.Title level={2}>投稿发布</Typography.Title><Alert type="info" showIcon message="发布能力正在建设" description="入口和发布状态已经预留；接入具体投稿平台前，不会代替用户发送作品。" /><Card style={{ marginTop: 18 }}><Steps direction="vertical" current={0} items={[{ title: '选择已完成作品', description: '仅展示已完成自检并确认的作品' }, { title: '平台规范检查', description: '按目标平台执行格式和合规检查' }, { title: '生成投稿包', description: '整理剧本、角色表、目录和审核报告' }, { title: '用户确认发布', description: '接入平台后仍需用户最终确认' }]} /></Card><Card style={{ marginTop: 18 }}><Empty image={<CloudUploadOutlined style={{ fontSize: 42 }} />} description="尚未配置投稿平台"><Space><Button disabled icon={<SafetyCertificateOutlined />}>配置投稿平台</Button></Space></Empty></Card></AppShell>;
}
