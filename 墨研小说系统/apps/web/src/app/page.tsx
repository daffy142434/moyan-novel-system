'use client';

import '@ant-design/v5-patch-for-react-19';
import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Segmented, Space, Typography, message } from 'antd';
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { api, readableError, session } from '../lib/api';

type Mode = 'login' | 'register';

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (session.hasToken()) router.replace('/app');
  }, [router]);

  async function submit(values: { email: string; password: string; displayName?: string }) {
    setLoading(true);
    try {
      const auth = mode === 'login'
        ? await api.login({ email: values.email, password: values.password })
        : await api.register({
            email: values.email,
            password: values.password,
            displayName: values.displayName ?? '',
          });
      session.save(auth);
      router.replace('/app');
    } catch (error) {
      messageApi.error(readableError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      {contextHolder}
      <section className="brand-panel">
        <div className="brand-kicker">AI STORY STUDIO</div>
        <h1 className="brand-mark">墨研</h1>
        <p className="brand-copy">
          把成熟的短篇创作方法，变成每一步都可见、可修改、可确认的写作过程。
          从故事大纲到五章成稿，创作权始终在你手中。
        </p>
        <div className="brand-flow" aria-label="短篇创作流程">
          {['故事大纲', '人物小传', '章节目录', '第一章', '第二章', '第三章', '第四章', '第五章'].map((item) => (
            <span className="flow-chip" key={item}>{item}</span>
          ))}
        </div>
      </section>
      <section className="auth-panel">
        <Card className="auth-card" styles={{ body: { padding: 34 } }}>
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <div>
              <Typography.Title level={2} style={{ margin: 0 }}>开始创作</Typography.Title>
              <Typography.Text type="secondary">登录后继续你的小说项目</Typography.Text>
            </div>
            <Segmented<Mode>
              block
              value={mode}
              onChange={setMode}
              options={[{ label: '登录', value: 'login' }, { label: '注册', value: 'register' }]}
            />
            <Form layout="vertical" onFinish={submit} requiredMark={false} key={mode}>
              {mode === 'register' && (
                <Form.Item name="displayName" label="昵称" rules={[{ required: true, message: '请输入昵称' }, { max: 50 }]}>
                  <Input prefix={<UserOutlined />} placeholder="你希望被怎样称呼" size="large" />
                </Form.Item>
              )}
              <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
                <Input prefix={<MailOutlined />} placeholder="name@example.com" size="large" />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }, { min: 8, message: '至少 8 位字符' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="至少 8 位字符" size="large" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                {mode === 'login' ? '登录墨研' : '创建账号'}
              </Button>
            </Form>
          </Space>
        </Card>
      </section>
    </main>
  );
}
