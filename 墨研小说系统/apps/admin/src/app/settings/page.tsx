'use client';
import { Button, Form, Input, InputNumber, Switch, Spin, message, Card } from 'antd';
import { useEffect, useState } from 'react';
import { settings } from '@/lib/api';

export default function SettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  useEffect(() => { settings.get().then(d => { form.setFieldsValue(d); setLoading(false); }); }, []);

  async function save() {
    const values = await form.validateFields();
    await settings.update(values);
    message.success('已保存');
  }

  if (loading) return <Spin style={{ margin: '40px auto', display: 'block' }} />;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>系统配置</h2>
      <Card style={{ maxWidth: 600 }}>
        <Form form={form} layout="vertical">
          <Form.Item name="registration_open" label="开放注册" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="default_credits" label="新用户赠送积分"><InputNumber min={0} /></Form.Item>
          <Form.Item name="tone_required" label="故事基调必选" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item>
            <Button type="primary" onClick={save}>保存配置</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
