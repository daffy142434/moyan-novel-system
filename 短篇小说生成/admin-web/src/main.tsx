import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ApiOutlined,
  AuditOutlined,
  DatabaseOutlined,
  FileDoneOutlined,
  LoginOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  ConfigProvider,
  Form,
  Input,
  Layout,
  Menu,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Row,
  Col,
  message,
} from 'antd'
import './style.css'

const { Header, Sider, Content } = Layout
const { Title, Text } = Typography
const API = 'http://127.0.0.1:8001/api/v1'

type UserRow = { id: string; phone: string; nickname: string; role: string; is_active: boolean }
type PromptRow = { node_type: string; label: string; version: number; updated_at: string }
type Stats = { users: number; novels: number; reports: number; prompts: number }

function AdminApp() {
  const [token, setToken] = useState(localStorage.getItem('admin_token') || '')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [page, setPage] = useState('overview')
  const [users, setUsers] = useState<UserRow[]>([])
  const [prompts, setPrompts] = useState<PromptRow[]>([])
  const [stats, setStats] = useState<Stats>({ users: 0, novels: 0, reports: 0, prompts: 0 })
  const [messageApi, contextHolder] = message.useMessage()

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token])

  const api = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const res = await fetch(`${API}${path}`, { ...options, headers: { ...(token ? headers : { 'Content-Type': 'application/json' }), ...(options.headers || {}) } })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  const login = async () => {
    await api('/auth/sms/send', { method: 'POST', body: JSON.stringify({ phone }) })
    const res = await api<{ token: string; user: { role: string } }>('/auth/sms/login', { method: 'POST', body: JSON.stringify({ phone, code }) })
    localStorage.setItem('admin_token', res.token)
    setToken(res.token)
    messageApi.success('已进入管理后台')
  }

  useEffect(() => {
    if (!token) return
    api<UserRow[]>('/admin/users').then(setUsers).catch(() => undefined)
    api<PromptRow[]>('/admin/prompts').then(setPrompts).catch(() => undefined)
    api<Stats>('/admin/stats').then(setStats).catch(() => undefined)
  }, [token])

  if (!token) {
    return (
      <ConfigProvider theme={{ token: { colorPrimary: '#722ed1' } }}>
        {contextHolder}
        <Layout className="login-shell">
          <Card className="login-card">
            <Space direction="vertical" size={18} className="full-width">
              <div className="brand"><SafetyCertificateOutlined />短篇小说生成</div>
              <div>
                <Title level={2}>管理后台登录</Title>
                <Text type="secondary">独立管理地址，仅用于系统运营。</Text>
              </div>
              <Form layout="vertical" onFinish={login}>
                <Form.Item label="手机号"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="管理员手机号" /></Form.Item>
                <Form.Item label="验证码"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="体验版验证码 123456" /></Form.Item>
                <Button type="primary" htmlType="submit" block icon={<LoginOutlined />}>进入管理后台</Button>
              </Form>
            </Space>
          </Card>
        </Layout>
      </ConfigProvider>
    )
  }

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#722ed1' } }}>
      {contextHolder}
      <Layout className="admin-shell">
        <Header className="admin-header">
          <div className="brand"><SafetyCertificateOutlined />短篇小说生成</div>
          <Button onClick={() => { localStorage.removeItem('admin_token'); setToken('') }}>退出</Button>
        </Header>
        <Layout>
          <Sider className="admin-sider" width={232}>
            <Menu selectedKeys={[page]} onClick={({ key }) => setPage(key)} items={[
              { key: 'overview', icon: <AuditOutlined />, label: '总览' },
              { key: 'users', icon: <UserOutlined />, label: '用户管理' },
              { key: 'library', icon: <DatabaseOutlined />, label: '小说库' },
              { key: 'prompts', icon: <FileDoneOutlined />, label: '节点提示词' },
              { key: 'models', icon: <ApiOutlined />, label: '模型配置' },
            ]} />
          </Sider>
          <Content className="admin-content">
            {page === 'overview' && (
              <Row gutter={[16, 16]}>
                <Col span={6}><Card><Statistic title="用户数" value={stats.users} /></Card></Col>
                <Col span={6}><Card><Statistic title="提示词节点" value={stats.prompts} /></Card></Col>
                <Col span={6}><Card><Statistic title="小说数" value={stats.novels} /></Card></Col>
                <Col span={6}><Card><Statistic title="评审报告" value={stats.reports} /></Card></Col>
              </Row>
            )}
            {page === 'users' && <Card title="用户管理"><Table rowKey="id" dataSource={users} columns={[{ title: '手机号', dataIndex: 'phone' }, { title: '昵称', dataIndex: 'nickname' }, { title: '角色', dataIndex: 'role' }, { title: '状态', dataIndex: 'is_active', render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag> }]} /></Card>}
            {page === 'prompts' && <Card title="节点提示词"><Table rowKey="node_type" dataSource={prompts} columns={[{ title: '节点', dataIndex: 'label' }, { title: '版本', dataIndex: 'version' }, { title: '更新时间', dataIndex: 'updated_at' }]} /></Card>}
            {page === 'library' && <Card title="小说库"><Button type="primary">上传原文并拆解</Button></Card>}
            {page === 'models' && <Card title="模型配置"><Table dataSource={[{ key: 'writing', node: '正文写作', model: 'deepseek-chat', temp: 0.8 }]} columns={[{ title: '节点', dataIndex: 'node' }, { title: '模型', dataIndex: 'model' }, { title: '温度', dataIndex: 'temp' }]} /></Card>}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
)
