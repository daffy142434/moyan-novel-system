'use client';
import '@ant-design/v5-patch-for-react-19';
import { useEffect, useState } from 'react';
import { Button, Card, Descriptions, Input, message, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { FileProtectOutlined, CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import { getToken } from '@/lib/api';

const API = 'http://localhost:3100/api';
async function fa(path: string, m='GET', b?: any) {
  const token = getToken();
  const r = await fetch(`${API}${path}`, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: b ? JSON.stringify(b) : undefined });
  return r.json();
}

const sc: Record<string, string> = { pending: 'processing', reviewing: 'processing', approved: 'success', rejected: 'error' };
const sl: Record<string, string> = { pending: '待审核', reviewing: '在审', approved: '通过', rejected: '退回' };

export default function ReviewsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [detailOpen, setDetailOpen] = useState<any>(null);
  const [reviewOpen, setReviewOpen] = useState<any>(null);
  const [comment, setComment] = useState('');

  async function load() {
    setLoading(true);
    const d = await fa(`/admin/reviews${filter?'?status='+filter:''}`);
    setItems(d.items || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [filter]);

  async function doReview(decision: string) {
    if (decision === 'rejected' && !comment.trim()) { message.error('拒绝必须填写修改建议'); return; }
    await fa(`/admin/reviews/${reviewOpen.id}`, 'PUT', { decision, comment });
    message.success(decision === 'approved' ? '已通过' : '已退回');
    setReviewOpen(null); setComment('');
    load();
  }

  const columns = [
    { title: '用户', dataIndex: 'user_email', ellipsis: true },
    { title: '标题', dataIndex: 'title' },
    { title: '集数', dataIndex: 'episode_count', width: 60 },
    { title: '机检分', dataIndex: 'machine_review_score', width: 70, render: (v: number) => v ? <Tag color={v>=90?'success':'error'}>{v}</Tag> : '-' },
    { title: '状态', dataIndex: 'status', width: 80, render: (s: string) => <Tag color={sc[s]}>{sl[s]}</Tag> },
    { title: '时间', render: (_: any, r: any) => new Date(r.created_at).toLocaleDateString() },
    { title: '操作', width: 160, render: (_: any, r: any) => <Space>
      <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailOpen(r)}>详情</Button>
      {r.status === 'pending' && <Button size="small" type="primary" onClick={() => { setReviewOpen(r); setComment(''); }}>审核</Button>}
    </Space> },
  ];

  return <>
    <Typography.Title level={3}><FileProtectOutlined /> 送审核</Typography.Title>
    <Space style={{ marginBottom: 16 }}>
      <Select value={filter} onChange={setFilter} allowClear placeholder="筛选状态" style={{ width: 140 }}
        options={Object.entries(sl).map(([k, v]) => ({ value: k, label: v }))} />
    </Space>
    <Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={{ pageSize: 20 }} size="middle" />

    {/* 详情弹窗 */}
    <Modal title="投稿详情" open={!!detailOpen} onCancel={() => setDetailOpen(null)} footer={null} width={750}>
      {detailOpen && <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="标题">{detailOpen.title}</Descriptions.Item>
          <Descriptions.Item label="用户">{detailOpen.user_email}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={sc[detailOpen.status]}>{sl[detailOpen.status]}</Tag></Descriptions.Item>
          <Descriptions.Item label="类型">{detailOpen.drama_type}</Descriptions.Item>
          <Descriptions.Item label="风格">{detailOpen.style_type}</Descriptions.Item>
          <Descriptions.Item label="集数">{detailOpen.episode_count}</Descriptions.Item>
          <Descriptions.Item label="机检">{detailOpen.machine_review_score}分 {detailOpen.machine_review_recommend?'✅推荐':'❌不推荐'}</Descriptions.Item>
          <Descriptions.Item label="时间" span={2}>{new Date(detailOpen.created_at).toLocaleString()}</Descriptions.Item>
        </Descriptions>
        {detailOpen.elements && <Card title="三要素" size="small"><pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 13, maxHeight: 200, overflow: 'auto' }}>{detailOpen.elements}</pre></Card>}
        {detailOpen.machine_review_report && <Card title={`机检报告 - ${detailOpen.machine_review_score}分`} size="small" style={{ background: detailOpen.machine_review_score >= 90 ? '#f6ffed' : '#fff2f0' }}><pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 13 }}>{detailOpen.machine_review_report}</pre></Card>}
        {detailOpen.reviewer_comment && <Card title="审核意见" size="small" style={{ background: '#fff2f0' }}><pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 13 }}>{detailOpen.reviewer_comment}</pre></Card>}
      </Space>}
    </Modal>

    {/* 审核弹窗 */}
    <Modal title="审核稿件" open={!!reviewOpen} onCancel={() => setReviewOpen(null)} footer={null} width={700}>
      {reviewOpen && <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="标题">{reviewOpen.title}</Descriptions.Item>
          <Descriptions.Item label="用户">{reviewOpen.user_email}</Descriptions.Item>
          <Descriptions.Item label="类型">{reviewOpen.drama_type}</Descriptions.Item>
          <Descriptions.Item label="风格">{reviewOpen.style_type}</Descriptions.Item>
          <Descriptions.Item label="机检分数">{reviewOpen.machine_review_score}</Descriptions.Item>
        </Descriptions>
        {reviewOpen.elements && <Card title="三要素" size="small"><pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 13, maxHeight: 150, overflow: 'auto' }}>{reviewOpen.elements}</pre></Card>}
        {reviewOpen.machine_review_report && <Card title="机检报告" size="small" style={{ background: '#f6ffed' }}><pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 13 }}>{reviewOpen.machine_review_report}</pre></Card>}
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>审核意见 {reviewOpen.reviewer_comment ? '(已有)' : '(必填，拒绝时必须填写修改建议)'}</Typography.Text>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="输入修改建议或审核意见..." rows={4} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, resize: 'vertical' }} />
        </div>
        <Space>
          <Button type="primary" icon={<CheckOutlined />} onClick={() => doReview('approved')}>审核通过</Button>
          <Button danger icon={<CloseOutlined />} onClick={() => doReview('rejected')}>审核拒绝</Button>
        </Space>
      </Space>}
    </Modal>
  </>;
}
