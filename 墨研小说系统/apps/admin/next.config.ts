import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@moyan/contracts', 'antd', '@ant-design/icons'],
};
export default config;
