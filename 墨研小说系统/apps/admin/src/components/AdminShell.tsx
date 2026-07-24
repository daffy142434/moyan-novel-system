'use client';
import '@ant-design/v5-patch-for-react-19';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Layout, Menu, Tag, Modal, Form, Input, message, type MenuProps, Button, Alert } from 'antd';
import { LogoutOutlined, HomeOutlined, TeamOutlined, CrownOutlined, EditOutlined, TagsOutlined, CodeOutlined, SettingOutlined, RobotOutlined, AuditOutlined, UserAddOutlined, KeyOutlined, BugOutlined } from '@ant-design/icons';
import { getToken, clearToken, getPermissions, setPermissions } from '@/lib/api';
import { theme } from 'antd';

type MenuItem = { key: string; label: string; icon?: React.ReactNode; children?: MenuItem[]; parentKey?: string };

const API = 'http://localhost:3100/api';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token: { colorBgContainer } } = theme.useToken();
  const [ready, setReady] = useState(false);
  const [perms, setPerms] = useState<string[]>([]);
  const [role, setRole] = useState('');
  const [pwdOpen, setPwdOpen] = useState(false);
  const [forcePwdOpen, setForcePwdOpen] = useState(false);
  const [pwdForm] = Form.useForm();

  useEffect(() => {
    if (!getToken() && pathname !== '/') { router.replace('/'); return; }
    const p = getPermissions() || [];
    setPerms(p);
    setRole(localStorage.getItem('moyan_admin_role') || '');

    // 检查是否需要强制改密
    const needChange = localStorage.getItem('moyan_admin_pwd_require') === 'true';
    if (needChange) setForcePwdOpen(true);
    else setReady(true);
  }, [pathname, router]);

  async function doChangePassword(v: any) {
    const token = getToken();
    const r = await fetch(`${API}/admin/change-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ oldPassword: v.oldPassword, newPassword: v.newPassword }),
    }).then(r => r.json());
    if (r.code) { message.error(r.message || '修改失败'); return; }
    message.success('密码已修改');
    setPwdOpen(false); setForcePwdOpen(false);
    localStorage.removeItem('moyan_admin_pwd_require');
    setReady(true);
  }

  if (pathname === '/') return <>{children}</>;

  const fullMenus: MenuItem[] = [
    { key: '/dashboard', label: '首页', icon: <HomeOutlined /> },
    {
      key: 'users', label: '用户管理', icon: <TeamOutlined />,
      children: [{ key: '/users-list', label: '用户管理', parentKey: 'users.list' }],
    },
    {
      key: 'writing', label: '写作配置', icon: <EditOutlined />,
      children: [
        { key: '/product-configs', label: '题材配置', parentKey: 'writing.topics' },
        { key: '/skill-prompts', label: 'SKILL配置', parentKey: 'writing.skills' },
        { key: '/writing-models', label: '模型配置', parentKey: 'writing.models' },
      ],
    },
    {
      key: 'models-group', label: '模型配置', icon: <RobotOutlined />,
      children: [{ key: '/models', label: '模型管理', parentKey: 'models.list' }],
    },
    {
      key: 'review', label: '审核管理', icon: <AuditOutlined />,
      children: [{ key: '/reviews', label: '审核列表', parentKey: 'review.list' }],
    },
    {
      key: 'system', label: '系统管理', icon: <SettingOutlined />,
      children: [
        { key: '/staff', label: '员工管理', parentKey: 'system.staff' },
        { key: '/dev-control', label: '开发控制', parentKey: 'system.settings' },
        { key: '/settings', label: '系统配置', parentKey: 'system.settings' },
      ],
    },
  ];

  function hasPerm(menu: MenuItem): boolean {
    if (!menu.parentKey) return true;
    if (role === 'admin') return true;
    return perms.includes(menu.parentKey);
  }

  function filterMenus(menus: MenuItem[]): any[] {
    return menus
      .filter(m => hasPerm(m) || (m.children?.some(c => hasPerm(c))))
      .map(m => ({ key: m.key, icon: m.icon, label: m.label, children: m.children ? filterMenus(m.children) : undefined }));
  }

  const selected = '/' + (pathname?.split('/')[1] || 'dashboard');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider theme="dark" width={200}>
        <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700, margin: '12px 0' }}>
          墨研·管理后台
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[selected]}
          items={filterMenus(fullMenus) as MenuProps['items']}
          onClick={({ key }) => router.push(key)}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header style={{ background: colorBgContainer, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
          {role && <Tag color={role === 'admin' ? 'purple' : role === 'writer' ? 'green' : 'blue'} style={{ marginRight: 12 }}>{role === 'admin' ? '系统管理员' : role === 'writer' ? '编剧' : '运营人员'}</Tag>}
          <Menu mode="horizontal" selectable={false} items={[
            { key: 'pwd', icon: <KeyOutlined />, label: '修改密码', onClick: () => { setPwdOpen(true); } },
            { key: 'logout', icon: <LogoutOutlined />, label: '退出', danger: true, onClick: () => { clearToken(); router.push('/'); } },
          ] as any} />
        </Layout.Header>
        <Layout.Content style={{ margin: 24, padding: 24, background: colorBgContainer, borderRadius: 8, minHeight: 280 }}>
          {ready ? children : null}
        </Layout.Content>
      </Layout>

      {/* 修改密码弹窗 */}
      <Modal title="修改密码" open={pwdOpen} onCancel={() => setPwdOpen(false)} footer={null} width={420}>
        <Form form={pwdForm} layout="vertical" onFinish={doChangePassword}>
          <Form.Item name="oldPassword" label="原密码" rules={[{ required: true }]}><Input.Password /></Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item>
          <Form.Item name="confirmPwd" label="确认新密码" dependencies={['newPassword']}
            rules={[{ required: true }, ({ getFieldValue }) => ({ validator: (_, v) => v === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject('两次密码不一致') })]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>修改密码</Button>
        </Form>
      </Modal>

      {/* 首次登录强制改密 */}
      <Modal title="首次登录 - 请修改密码" open={forcePwdOpen} closable={false} footer={null} width={420} maskClosable={false}>
        <Alert type="warning" showIcon message="为保障账户安全，首次登录必须修改默认密码" style={{ marginBottom: 16 }} />
        <Form form={pwdForm} layout="vertical" onFinish={doChangePassword}>
          <Form.Item name="oldPassword" label="原密码（默认: admin123456）" initialValue="admin123456" rules={[{ required: true }]}><Input.Password /></Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item>
          <Form.Item name="confirmPwd" label="确认新密码" dependencies={['newPassword']}
            rules={[{ required: true }, ({ getFieldValue }) => ({ validator: (_, v) => v === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject('两次密码不一致') })]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>确认修改</Button>
        </Form>
      </Modal>
    </Layout>
  );
}
