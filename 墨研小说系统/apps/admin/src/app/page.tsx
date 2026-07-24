'use client';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { auth, setToken, setRole, setPermissions } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [form] = Form.useForm();

  async function handleLogin(values: { email: string; password: string }) {
    try {
      const data = await auth.login(values.email, values.password);
      setToken(data.accessToken);
      setRole(data.role || 'operator');
      setPermissions(data.permissions || []);
      if (data.passwordChangeRequired) localStorage.setItem('moyan_admin_pwd_require', 'true');
      message.success('登录成功');
      router.push('/dashboard');
    } catch (e: any) {
      message.error(e.message || '登录失败');
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Card style={{ width: 400, boxShadow: '0 8px 32px rgba(0,0,0,.15)' }} title={<Typography.Title level={3} style={{ textAlign: 'center', margin: 0 }}>墨研管理后台</Typography.Title>}>
        <Form form={form} onFinish={handleLogin} size="large">
          <Form.Item name="email" rules={[{ required: true, message: '请输入管理员邮箱' }]}>
            <Input prefix={<UserOutlined />} placeholder="管理员邮箱" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>登录</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
