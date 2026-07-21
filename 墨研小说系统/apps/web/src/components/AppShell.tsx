'use client';

import '@ant-design/v5-patch-for-react-19';
import type { ReactNode } from 'react';
import { Layout } from 'antd';
import { AppHeader } from './AppHeader';

export function AppShell({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <Layout className="app-shell">
      <AppHeader />
      <Layout.Content>
        <div className={narrow ? 'narrow-wrap' : 'page-wrap'}>{children}</div>
      </Layout.Content>
    </Layout>
  );
}
