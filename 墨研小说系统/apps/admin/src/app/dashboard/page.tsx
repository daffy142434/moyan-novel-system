'use client';
import { Card, Col, Row, Statistic, Spin } from 'antd';
import { TeamOutlined, ApiOutlined, RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { dashboard } from '@/lib/api';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { dashboard.summary().then(setData).catch(() => {}); }, []);

  if (!data) return <Spin style={{ margin: '40px auto', display: 'block' }} />;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>系统概览</h2>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}><Card><Statistic title="用户总数" value={data.userCount || 0} prefix={<TeamOutlined />} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card><Statistic title="今日调用" value={data.todayCalls || 0} prefix={<ApiOutlined />} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card><Statistic title="活跃模型" value={data.activeModels || 0} prefix={<RobotOutlined />} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card><Statistic title="今日 Token" value={data.todayTokens || 0} prefix={<ThunderboltOutlined />} suffix="K" /></Card></Col>
      </Row>
    </div>
  );
}
