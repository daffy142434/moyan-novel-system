'use client';
import '@ant-design/v5-patch-for-react-19';
import { Button, Card, Form, Input, Select, message, Table, Tag, Typography, Checkbox, Space, Modal, Alert } from 'antd';
import { PlusOutlined, EditOutlined, UserAddOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/api';

const API = 'http://localhost:3100/api';
async function f(p: string, m = 'GET', b?: any) { const t = getToken(); return fetch(`${API}${p}`, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json()); }

const MENU_LABELS: Record<string, string> = {
  'users.list': '用户管理', 'users.memberships': '会员管理',
  'writing.topics': '题材配置', 'writing.skills': 'SKILL配置', 'writing.models': '写作模型配置',
  'models.list': '模型管理', 'review.list': '审核列表',
  'system.staff': '员工管理', 'system.settings': '系统配置',
};

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  useEffect(() => { f('/admin/staff').then(setStaff); }, []);

const [selAll, setSelAll] = useState(false);
  const [checkedPerms, setCheckedPerms] = useState<string[]>([]);

  function toggleAll(checked: boolean) {
    setSelAll(checked);
    const all = Object.keys(MENU_LABELS);
    setCheckedPerms(checked ? all : []);
  }

  function handlePermChange(vals: string[]) {
    setCheckedPerms(vals);
    setSelAll(vals.length === Object.keys(MENU_LABELS).length);
  }

  async function save(v: any) {
    try {
      v.permissions = checkedPerms;
      const r = await f('/admin/staff', 'POST', v);
      if (r.code) { message.error(r.code === 'EMAIL_EXISTS' ? '该邮箱已存在' : r.message || '创建失败'); return; }
      message.success('创建成功');
      setOpen(false); form.resetFields(); setCheckedPerms([]); setSelAll(false);
      f('/admin/staff').then(setStaff);
    } catch (e: any) { message.error(e.message || '网络错误'); }
  }
  async function update(id: string, v: any) {
    await f(`/admin/staff/${id}`, 'PUT', { permissions: checkedPerms });
    message.success('已更新');
    setEditing(null);
    f('/admin/staff').then(setStaff);
  }

  return <>
    <Typography.Title level={3}><UserAddOutlined /> 员工管理</Typography.Title>
    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }} style={{ marginBottom: 16 }}>创建员工</Button>
    <Table rowKey="id" dataSource={staff} columns={[
      { title: '邮箱', dataIndex: 'email' },
      { title: '姓名', dataIndex: 'display_name' },
      { title: '角色', dataIndex: 'role', render: (v: string) => <Tag color={v === 'admin' ? 'purple' : v === 'writer' ? 'green' : 'blue'}>{v === 'admin' ? '系统管理员' : v === 'writer' ? '编剧' : '运营人员'}</Tag> },
      { title: '权限数', render: (_: any, r: any) => <Tag>{(r.permissions || []).length} 项</Tag> },
      { title: '操作', render: (_: any, r: any) => <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setSelAll((r.permissions||[]).length === Object.keys(MENU_LABELS).length); setOpen(true); }}>编辑</Button> },
    ]} />
    <Modal title={editing ? '编辑员工' : '创建员工'} open={open} onCancel={() => { setOpen(false); setEditing(null); }} footer={null} width={560}>
      <Form form={form} layout="vertical" onFinish={editing ? (v: any) => update(editing.id, v) : save}>
        {!editing && <>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="displayName" label="姓名"><Input /></Form.Item>
          <Form.Item name="role" label="角色" initialValue="operator"><Select options={[{ label: '运营人员', value: 'operator' }, { label: '编剧', value: 'writer' }, { label: '系统管理员', value: 'admin' }]} /></Form.Item>
          <Alert type="info" showIcon message="默认密码: admin123456，首次登录后强制修改密码" style={{ marginBottom: 16 }} />
        </>}
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>菜单权限</div>
          <div style={{ marginBottom: 8 }}><Checkbox checked={selAll} onChange={e => toggleAll(e.target.checked)}>全选</Checkbox></div>
          <Checkbox.Group value={checkedPerms} onChange={handlePermChange} style={{ width: '100%' }}>
            <Space direction="vertical">
              {Object.entries(MENU_LABELS).map(([k, v]) => <Checkbox key={k} value={k}>{v} <Tag style={{ fontSize: 10, marginLeft: 4 }}>{k}</Tag></Checkbox>)}
            </Space>
          </Checkbox.Group>
        </div>
        <Button type="primary" htmlType="submit" block>{editing ? '更新' : '创建'}</Button>
      </Form>
    </Modal>
  </>;
}
