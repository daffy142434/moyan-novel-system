'use client';
import { Button, Card, Form, Input, Select, message, Typography } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import { users } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function CreateUserPage() {
  const router = useRouter();
  const [form] = Form.useForm();

  async function submit(v: any) {
    try {
      const r = await users.create(v);
      message.success(`用户 ${r.email} 创建成功，角色: ${r.role === 'admin' ? '系统管理员' : '运营人员'}`);
      form.resetFields();
    } catch (e: any) { message.error(e.message); }
  }

  return (
    <>
      <Typography.Title level={3}><UserAddOutlined /> 创建用户</Typography.Title>
      <Typography.Paragraph type="secondary">系统管理员在此创建运营或系统管理员账号。用户不能自行注册管理后台账号。</Typography.Paragraph>
      <Card style={{ maxWidth: 500 }}>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="user@example.com" size="large" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 8 }]}>
            <Input.Password placeholder="至少 8 位" size="large" />
          </Form.Item>
          <Form.Item name="displayName" label="姓名">
            <Input placeholder="可选" size="large" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]} initialValue="operator">
            <Select options={[
              { label: '运营人员 (作品配置, 送审核, 数据查看)', value: 'operator' },
              { label: '系统管理员 (全部权限 + 模型管理 + 创建用户)', value: 'admin' },
            ]} size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large">创建账号</Button>
        </Form>
      </Card>
    </>
  );
}
