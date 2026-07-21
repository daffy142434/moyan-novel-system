'use client';

import '@ant-design/v5-patch-for-react-19';
import { Avatar, Button, Dropdown, Layout, Menu, Space, Typography } from 'antd';
import { BookOutlined, DownOutlined, HomeOutlined, LogoutOutlined, MenuOutlined, RocketOutlined, SendOutlined, UserOutlined, WalletOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { session } from '../lib/api';

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<ReturnType<typeof session.user>>(null);
  useEffect(() => { setUser(session.user()); }, []);
  const navItems = [
    { key: '/app', label: '首页', icon: <HomeOutlined /> },
    { key: '/app/workbench', label: '工作台', icon: <RocketOutlined /> },
    { key: '/app/library', label: '小说集', icon: <BookOutlined /> },
    { key: '/app/publish', label: '投稿发布', icon: <SendOutlined /> },
  ];
  const selectedKey = [...navItems].reverse().find((item) => pathname === item.key || (item.key !== '/app' && pathname.startsWith(item.key)))?.key ?? '/app';
  const menuItems = navItems.map((item) => ({ ...item, label: <Link href={item.key}>{item.label}</Link> }));

  function logout() {
    session.clear();
    router.replace('/');
  }

  return (
    <Layout.Header className="topbar">
      <Link className="topbar-brand" href="/app">墨研小说</Link>
      <Menu
        className="topbar-nav"
        mode="horizontal"
        selectedKeys={[selectedKey]}
        items={menuItems}
      />
      <div className="topbar-actions">
        <Link href="/app/membership"><Button icon={<WalletOutlined />}>积分账户</Button></Link>
        <Dropdown
          trigger={['click']}
          menu={{ items: [{ key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: logout }] }}
        >
          <Button type="text">
            <Space>
              <Avatar size="small" icon={<UserOutlined />} />
              <Typography.Text className="user-name">{user?.displayName ?? '创作者'}</Typography.Text>
              <DownOutlined style={{ fontSize: 11 }} />
            </Space>
          </Button>
        </Dropdown>
        <Dropdown
          trigger={['click']}
          menu={{ selectedKeys: [selectedKey], items: menuItems }}
        >
          <Button className="mobile-nav-trigger" type="text" icon={<MenuOutlined />} aria-label="打开导航" />
        </Dropdown>
      </div>
    </Layout.Header>
  );
}
