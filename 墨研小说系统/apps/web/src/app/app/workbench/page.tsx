'use client';

import '@ant-design/v5-patch-for-react-19';
import { ArrowRightOutlined, LockOutlined, RocketOutlined } from '@ant-design/icons';
import { Button, Card, Col, Row, Skeleton, Space, Tag, Typography, message } from 'antd';
import type { ProductDefinitionDto } from '@moyan/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/AppShell';
import { api, readableError, session } from '../../../lib/api';

export default function WorkbenchPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductDefinitionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();
  useEffect(() => {
    if (!session.hasToken()) { router.replace('/'); return; }
    api.products().then(setProducts).catch((error) => messageApi.error(readableError(error))).finally(() => setLoading(false));
  }, [messageApi, router]);
  function openProduct(product: ProductDefinitionDto) {
    if (!product.enabled) return;
    router.push(`/app/workbench/create/${product.type}`);
  }
  return <AppShell>{contextHolder}
    <div className="page-heading"><div><div className="eyebrow">CREATION WORKBENCH</div><Typography.Title level={2}>选择创作能力</Typography.Title><Typography.Text type="secondary">选择创作类型并开始建立新作品</Typography.Text></div></div>
    {loading ? <Skeleton active /> : <Row gutter={[18, 18]}>{products.map((product) => <Col xs={24} md={12} xl={8} key={product.type}>
      <Card className={`product-card ${!product.enabled ? 'disabled' : ''}`} hoverable={product.enabled} onClick={() => openProduct(product)}>
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}><span className="product-icon">{product.enabled ? <RocketOutlined /> : <LockOutlined />}</span>{product.badge && <Tag color={product.enabled ? 'gold' : 'default'}>{product.badge}</Tag>}</Space>
          <div><Typography.Title level={3}>{product.title}</Typography.Title><Typography.Paragraph type="secondary" style={{ minHeight: 44 }}>{product.description}</Typography.Paragraph></div>
          <div style={{ textAlign: 'right' }}><Button type="link" disabled={!product.enabled}>{product.enabled ? <>进入 <ArrowRightOutlined /></> : '即将开放'}</Button></div>
        </Space>
      </Card>
    </Col>)}</Row>}
  </AppShell>;
}
