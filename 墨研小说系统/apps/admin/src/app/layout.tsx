import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AdminShell } from '@/components/AdminShell';

export const metadata: Metadata = { title: '墨研管理后台' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0 }}>
        <AntdRegistry>
          <AdminShell>{children}</AdminShell>
        </AntdRegistry>
      </body>
    </html>
  );
}
