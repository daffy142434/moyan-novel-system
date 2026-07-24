'use client';

import '@ant-design/v5-patch-for-react-19';
import { Suspense, useEffect, useState } from 'react';
import { Button, Card, Form, Input, Segmented, Space, Typography, message } from 'antd';
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, readableError, session } from '../../lib/api';

type Mode = 'login' | 'register';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('register') === '1' ? 'register' : 'login');
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const redirect = params.get('redirect') || '/app';

  useEffect(() => {
    if (session.hasToken()) router.replace(redirect);
  }, [router, redirect]);

  // 已登录时渲染空白避免闪现
  if (session.hasToken()) return null;

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
      router.replace(redirect);
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
          把成熟的剧本创作方法，变成每一步都可见、可修改、可确认的创作过程。
          从创作方案到分集剧本，创作权始终在你手中。
        </p>
        <div className="brand-flow" aria-label="短篇创作流程">
          {['制作模式', '题材定位', '创作设定', '创作方案', '角色开发', '目录大纲', '分集创作'].map((item) => (
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

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
