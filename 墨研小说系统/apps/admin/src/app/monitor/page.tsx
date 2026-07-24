'use client';
import { Card, Col, Row, Statistic, Table, Tag, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { dashboard } from '@/lib/api';

export default function MonitorPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { dashboard.modelUsage().then(setData); }, []);

  if (!data) return <Spin style={{ margin: '40px auto', display: 'block' }} />;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>模型调用监控</h2>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {data.models?.map((m: any) => (
          <Col xs={24} sm={12} md={8} key={m.model}>
            <Card title={m.model} size="small">
              <Row gutter={16}>
                <Col span={12}><Statistic title="调用" value={m.calls} suffix="次" /></Col>
                <Col span={12}><Statistic title="成功率" value={m.success_rate} suffix="%" precision={1} valueStyle={{ color: m.success_rate > 90 ? '#3f8600' : '#cf1322' }} /></Col>
              </Row>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
