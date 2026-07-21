import type { Metadata } from 'next';
import '@ant-design/v5-patch-for-react-19';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './globals.css';

export const metadata: Metadata = {
  title: '墨研小说',
  description: '中文剧本与小说创作平台',
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
                colorPrimary: '#1677ff',
                colorInfo: '#1677ff',
                colorSuccess: '#52c41a',
                colorWarning: '#faad14',
                colorError: '#ff4d4f',
                colorBgBase: '#ffffff',
                colorBgLayout: '#f5f5f5',
                borderRadius: 10,
                fontFamily: 'Inter, PingFang SC, Microsoft YaHei, sans-serif',
              },
              components: {
                Layout: { bodyBg: '#f5f5f5', headerBg: '#ffffff' },
                Menu: { itemSelectedColor: '#1677ff', horizontalItemSelectedColor: '#1677ff' },
                Card: { headerBg: '#ffffff' },
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
