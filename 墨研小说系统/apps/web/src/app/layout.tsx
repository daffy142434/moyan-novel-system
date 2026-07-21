import type { Metadata } from 'next';
import '@ant-design/v5-patch-for-react-19';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './globals.css';

export const metadata: Metadata = {
  title: '墨研小说',
  description: '基于专业创作 Skill 的中文小说创作平台',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <ConfigProvider
            locale={zhCN}
            theme={{
              token: {
                colorPrimary: '#6f4e37',
                colorInfo: '#6f4e37',
                borderRadius: 10,
                fontFamily: 'Inter, PingFang SC, Microsoft YaHei, sans-serif',
              },
            }}
          >
            {children}
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
