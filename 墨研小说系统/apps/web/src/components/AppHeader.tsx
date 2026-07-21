'use client';

import '@ant-design/v5-patch-for-react-19';
import { Button, Dropdown, Space, Typography } from 'antd';
import { DownOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { session } from '../lib/api';

export function AppHeader() {
  const router = useRouter();
  const user = session.user();

  function logout() {
    session.clear();
    router.replace('/');
  }

  return (
    <header className="topbar">
      <Link className="topbar-brand" href="/app">墨研小说</Link>
      <Dropdown
        trigger={['click']}
        menu={{ items: [{ key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: logout }] }}
      >
        <Button type="text">
          <Space>
            <UserOutlined />
            <Typography.Text>{user?.displayName ?? '创作者'}</Typography.Text>
            <DownOutlined style={{ fontSize: 11 }} />
          </Space>
        </Button>
      </Dropdown>
    </header>
  );
}
