import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Avatar,
  Breadcrumb,
  Button,
  Card,
  Col,
  ConfigProvider,
  Divider,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Grid,
  Input,
  Layout,
  List,
  Menu,
  Modal,
  Progress,
  Radio,
  Row,
  Segmented,
  Select,
  Slider,
  Space,
  Steps,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
  Spin,
} from 'antd'
import {
  BookOutlined,
  CheckCircleOutlined,
  DownOutlined,
  EditOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  LoginOutlined,
  LogoutOutlined,
  MessageOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReadOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
  CopyOutlined,
  DeleteOutlined,
  HistoryOutlined,
  SoundOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons'
import './App.css'

const { Header, Content, Sider } = Layout
const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const API = 'http://127.0.0.1:8001/api/v1'

type Screen = 'home' | 'login' | 'app' | 'settings' | 'reader'
type Page = 'dashboard' | 'workspace' | 'portfolio' | 'discover'
type Novel = {
  id: string
  title: string
  genre: string
  status: string
  pipeline_mode?: 'manual' | 'auto'
  target_words: number
  word_count: number
  collection_id?: string | null
  final_content?: string | null
  premise?: string | null
  prompt_template_id?: string | null
}
type Collection = { id: string; name: string; description?: string; novels?: Novel[]; novel_count?: number }
type OutlinePart = { part?: string; main_event?: string; sub_events?: string[] | string; emotion?: string; word_target?: number | string; hook?: string; clue?: string }
type Candidate = {
  id: string
  title: string
  summary: string
  emotion: string
  tags: string[]
  detail: string
  setting?: string
  core_conflict?: string
  emotion_position?: string
  logline?: string
  core_reversal?: string | Record<string, unknown>
  emotion_curve?: string | Record<string, unknown>
  character_sketch?: string | Record<string, unknown>
  five_part_outline?: OutlinePart[]
  logic_check?: string | Record<string, unknown>
}
type CandidateModule = { key: string; label: string }
type NodeState = {
  index: number
  type: string
  status: string
  cards?: Candidate[] | null
  selected_card?: string | null
  selected_card_data?: Candidate | null
  content?: string | null
}
type User = { id: string; phone: string; nickname: string }
type Report = { id: string; round_no: number; source_snapshot: string; report: { summary: string; scores: Record<string, number>; issues: Array<{ gate: string; title: string; count: number }> } }
type Platform = { id: string; name: string; fit: string; format_note: string; guide: string }
type PromptTemplate = { id: string; name: string; description: string; is_default: boolean }

const flowItems = [
  { title: '定题材', description: '选择故事方向' },
  { title: '核心框架', description: '确认反转与人设' },
  { title: '小节大纲', description: '确认五段结构' },
  { title: '正文写作', description: '生成正文并评审' },
]

const statusLabels: Record<string, string> = {
  draft: '草稿',
  pending: '待开始',
  card_selection: '选择方案',
  node1_done: '已定题材',
  node2_done: '已定框架',
  node3_done: '已定大纲',
  writing_done: '正文待确认',
  completed: '已完成',
  abandoned: '已废弃',
}

const genreCards = [
  { genre: '现实反转', title: '现实反转', desc: '日常处境、情绪压抑、结尾反转' },
  { genre: '悬疑', title: '悬疑', desc: '信息差、误导线索、真相回收' },
  { genre: '都市治愈', title: '都市治愈', desc: '生活质感、关系修复、余韵温柔' },
]

const nodeModules: Record<number, CandidateModule[]> = {
  0: [
    { key: 'setting', label: '完整设定' },
    { key: 'core_conflict', label: '核心冲突' },
    { key: 'emotion_position', label: '情绪定位' },
  ],
  1: [
    { key: 'logline', label: '一句话梗概' },
    { key: 'core_reversal', label: '核心反转' },
    { key: 'emotion_curve', label: '情绪曲线' },
    { key: 'character_sketch', label: '人设速写' },
  ],
  2: [
    { key: 'five_part_outline', label: '5段结构概览' },
    { key: 'logic_check', label: '反转与伏笔检查' },
  ],
}

const cloneCard = (card: Candidate): Candidate => JSON.parse(JSON.stringify(card))

const moduleText = (value: unknown) => {
  if (Array.isArray(value) || (value && typeof value === 'object')) return JSON.stringify(value, null, 2)
  return String(value || '')
}

const cardModuleDetail = (nodeIndex: number, card: Candidate) =>
  (nodeModules[nodeIndex] || [])
    .map((item) => `【${item.label}】\n${moduleText((card as Record<string, unknown>)[item.key])}`)
    .join('\n\n')

const objectValue = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {
      return { content: value }
    }
  }
  return {}
}

const fieldLabelMap: Record<string, string> = {
  reversal_type: '反转类型',
  reversal_content: '反转内容',
  clues: '铺垫线索',
  opening: '开头情绪',
  middle: '中段情绪',
  reversal: '反转情绪',
  ending: '结尾情绪',
  protagonist: '主角',
  key_characters: '关键角色',
  relationship: '人物关系',
  content: '内容',
}

function App() {
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [messageApi, contextHolder] = message.useMessage()
  const [screen, setScreen] = useState<Screen>('home')
  const [page, setPage] = useState<Page>('dashboard')
  const [token, setToken] = useState(() => localStorage.getItem('token') || '')
  const [user, setUser] = useState<User | null>(null)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [writingNovels, setWritingNovels] = useState<Novel[]>([])
  const [portfolio, setPortfolio] = useState<{ collections: Collection[]; ungrouped: Novel[] }>({ collections: [], ungrouped: [] })
  const [collections, setCollections] = useState<Collection[]>([])
  const [activeNovel, setActiveNovel] = useState<Novel | null>(null)
  const [workspaceMode, setWorkspaceMode] = useState<'edit' | 'view'>('edit')
  const [workspaceTab, setWorkspaceTab] = useState<'info' | 'directory' | 'settings'>('info')
  const [activeNode, setActiveNode] = useState(0)
  const [nodeStates, setNodeStates] = useState<NodeState[]>([])
  const [cards, setCards] = useState<Candidate[]>([])
  const [cardsLoading, setCardsLoading] = useState(false)
  const [writingLoading, setWritingLoading] = useState(false)
  const [selectedCard, setSelectedCard] = useState<Candidate | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editedCard, setEditedCard] = useState<Candidate | null>(null)
  const [editScope, setEditScope] = useState<'field' | 'card'>('field')
  const [editField, setEditField] = useState('setting')
  const [aiInstruction, setAiInstruction] = useState('')
  const [aiReply, setAiReply] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [collectionView, setCollectionView] = useState<'card' | 'list'>('card')
  const [writingContent, setWritingContent] = useState('')
  const [writingDirty, setWritingDirty] = useState(false)
  const [writingProgress, setWritingProgress] = useState<{ percent: number; message: string }>({ percent: 0, message: '等待生成' })
  const [reports, setReports] = useState<Report[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([])
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoProgress, setAutoProgress] = useState<Array<{ node: number; message: string; card?: Candidate }>>([])
  const [chapterTitle, setChapterTitle] = useState('')
  const [undoStack, setUndoStack] = useState<string[]>([])
  const [redoStack, setRedoStack] = useState<string[]>([])

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token])

  const api = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...(token ? authHeaders : { 'Content-Type': 'application/json' }), ...(options.headers || {}) },
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json() as Promise<T>
  }

  const loadUserData = async () => {
    if (!token) return
    const [me, writing, groupRows, port, templates] = await Promise.all([
      api<User>('/users/me'),
      api<Novel[]>('/novels/writing'),
      api<Collection[]>('/collections'),
      api<{ collections: Collection[]; ungrouped: Novel[] }>('/portfolio'),
      api<PromptTemplate[]>('/prompt-templates'),
    ])
    setUser(me)
    setWritingNovels(writing)
    setCollections(groupRows)
    setPortfolio(port)
    setPromptTemplates(templates)
    if (!activeNovel && writing[0]) setActiveNovel(writing[0])
  }

  const loadDiscover = async () => {
    if (!token) return
    const rows = await api<Platform[]>('/discover/platforms')
    setPlatforms(rows)
  }

  const loadNodes = async (novelId: string) => {
    const rows = await api<NodeState[]>(`/novels/${novelId}/nodes`)
    setNodeStates(rows)
    return rows
  }

  const isNodeConfirmed = (nodeIndex: number) => {
    const node = nodeStates.find((item) => item.index === nodeIndex)
    return node?.status === 'confirmed' && Boolean(node.content)
  }

  const canOpenNode = (zeroBasedIndex: number) => {
    if (workspaceMode === 'view') return true
    if (zeroBasedIndex === 3 && Boolean(activeNovel?.final_content)) return true
    if (zeroBasedIndex === 0) return true
    return Array.from({ length: zeroBasedIndex }, (_, index) => index + 1).every(isNodeConfirmed)
  }

  const firstLockedReason = (zeroBasedIndex: number) => {
    const missing = Array.from({ length: zeroBasedIndex }, (_, index) => index + 1).find((index) => !isNodeConfirmed(index))
    return missing ? `请先确认「${flowItems[missing - 1].title}」后再继续` : ''
  }

  useEffect(() => {
    if (token) {
      setScreen('app')
      setPage('dashboard')
      loadUserData().catch(() => {
        localStorage.removeItem('token')
        setToken('')
      })
    }
  }, [token])

  useEffect(() => {
    if (!activeNovel || !token) return
    loadNodes(activeNovel.id).catch(() => messageApi.error('节点状态加载失败'))
  }, [activeNovel?.id, token])

  useEffect(() => {
    if (!activeNovel || activeNode > 2 || !token || !nodeStates.length) return
    if (workspaceMode === 'view') return
    if (!canOpenNode(activeNode)) {
      setCards([])
      setSelectedCard(null)
      setCardsLoading(false)
      return
    }
    const node = nodeStates.find((item) => item.index === activeNode + 1)
    if (node?.status === 'confirmed' && node.selected_card_data) {
      setCards([])
      setSelectedCard(node.selected_card_data)
      setCardsLoading(false)
      return
    }
    if (node?.cards?.length) {
      setCards(node.cards)
      setSelectedCard(node.cards[0] || null)
      setCardsLoading(false)
      return
    }
    setCardsLoading(true)
    api<Candidate[]>(`/novels/${activeNovel.id}/nodes/${activeNode + 1}/cards`)
      .then((rows) => {
        setCards(rows)
        setSelectedCard(rows[0] || null)
        setNodeStates((items) => items.map((item) => item.index === activeNode + 1 ? { ...item, cards: rows, status: 'card_selection' } : item))
      })
      .catch(() => messageApi.error('节点卡片加载失败'))
      .finally(() => setCardsLoading(false))
  }, [activeNovel?.id, activeNode, token, nodeStates.length])

  useEffect(() => {
    if (workspaceMode === 'view') return
    if (activeNode === 3 && activeNovel) {
      if (!canOpenNode(3)) return
      if (activeNovel.final_content) {
        setWritingContent(activeNovel.final_content)
        setWritingProgress({ percent: 100, message: '已生成正文' })
      } else if (!writingLoading) {
        generateWriting()
      }
    }
  }, [activeNode, activeNovel?.id, activeNovel?.final_content, nodeStates.length, workspaceMode])

  useEffect(() => {
    if (page === 'discover') {
      loadDiscover().catch(() => messageApi.error('发现数据加载失败'))
    }
  }, [page, token])

  const sendCode = async () => {
    await api('/auth/sms/send', { method: 'POST', body: JSON.stringify({ phone }) })
    messageApi.success('验证码已发送，体验版验证码为 123456')
  }

  const login = async () => {
    const res = await api<{ token: string; user: User }>('/auth/sms/login', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    })
    localStorage.setItem('token', res.token)
    setToken(res.token)
    setUser(res.user)
  }

  const saveProfile = async (values: { nickname: string }) => {
    const updated = await api<User>('/users/me', { method: 'PUT', body: JSON.stringify(values) })
    setUser(updated)
    messageApi.success('个人资料已保存')
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken('')
    setUser(null)
    setScreen('home')
  }

  const createNovel = async (values: { title: string; genre: string; target_words: number; collection_id?: string; pipeline_mode: 'manual' | 'auto'; premise?: string; prompt_template_id?: string }) => {
    const novel = await api<Novel>('/novels', { method: 'POST', body: JSON.stringify(values) })
    setCreateOpen(false)
    setActiveNovel(novel)
    setWorkspaceMode('edit')
    setWorkspaceTab('info')
    setActiveNode(0)
    setWritingContent('')
    setWritingDirty(false)
    setReports([])
    setAutoProgress([])
    await loadUserData()
    await loadNodes(novel.id)
    setPage('workspace')
    messageApi.success('小说已创建')
    if (values.pipeline_mode === 'auto') {
      runAutoPipeline(novel.id)
    }
  }

  const runAutoPipeline = async (novelId: string) => {
    setAutoRunning(true)
    setAutoProgress([])
    const res = await fetch(`${API}/novels/${novelId}/auto/run`, { method: 'POST', headers: authHeaders })
    const reader = res.body?.getReader()
    if (!reader) {
      setAutoRunning(false)
      return
    }
    const decoder = new TextDecoder()
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      const lines = text.split('\n').filter((line) => line.startsWith('data: '))
      for (const line of lines) {
        const data = JSON.parse(line.replace('data: ', ''))
        if (data.error) {
          messageApi.error(data.error)
          setAutoRunning(false)
          return
        }
        if (data.node && data.message) {
          setAutoProgress((items) => [...items, { node: data.node, message: data.message, card: data.card }])
          setActiveNode(Math.min(Number(data.node) - 1, 3))
          if (data.card) {
            setNodeStates((items) => items.map((item) => item.index === data.node ? {
              ...item,
              status: 'confirmed',
              selected_card: data.card.id,
              selected_card_data: data.card,
              content: cardModuleDetail(Number(data.node) - 1, data.card),
              cards: [data.card],
            } : item))
            setActiveNovel((current) => current ? { ...current, status: `node${data.node}_done` } : current)
          }
        }
        if (data.content) {
          setWritingContent(data.content)
          setWritingProgress({ percent: 100, message: '正文已生成，等待确认保存' })
          setActiveNovel((current) => current ? { ...current, final_content: data.content, word_count: data.content.length, status: 'writing_done' } : current)
          setNodeStates((items) => items.map((item) => item.index === 4 ? { ...item, status: 'confirmed', content: data.content } : item))
          setWorkspaceTab('directory')
          setActiveNode(3)
        }
      }
    }
    await loadNovelDetail(novelId)
    await loadNodes(novelId)
    await loadUserData()
    setAutoRunning(false)
    messageApi.success('自动写作已完成')
  }

  const refreshCards = async () => {
    if (!activeNovel || activeNode > 2) return
    if (!canOpenNode(activeNode)) {
      messageApi.warning(firstLockedReason(activeNode))
      return
    }
    setCardsLoading(true)
    try {
      const rows = await api<Candidate[]>(`/novels/${activeNovel.id}/nodes/${activeNode + 1}/refresh`, { method: 'POST' })
      setCards(rows)
      setSelectedCard(rows[0] || null)
      setNodeStates((items) => items.map((item) => item.index === activeNode + 1 ? { ...item, cards: rows, selected_card_data: null, status: 'card_selection' } : item))
    } catch {
      messageApi.error('换一批失败')
    } finally {
      setCardsLoading(false)
    }
  }

  const openEditCard = (card: Candidate) => {
    const draft = cloneCard(card)
    const firstField = activeNode === 2 ? 'five_part_outline:0' : nodeModules[activeNode]?.[0]?.key || 'detail'
    setSelectedCard(card)
    setEditedCard(draft)
    setEditField(firstField)
    setEditScope('field')
    setAiInstruction('')
    setAiReply('')
    setEditOpen(true)
  }

  const confirmSelectedCard = async (force = false, cardArg?: Candidate) => {
    const card = cardArg || selectedCard
    if (!activeNovel || !card) return
    const finalCard = { ...card, detail: cardModuleDetail(activeNode, card) }
    const payload = { card_id: finalCard.id, edited_card: finalCard, edited_content: finalCard.detail, reset_after: force }
    const res = await api<{ requires_confirmation: boolean; message?: string }>(`/novels/${activeNovel.id}/nodes/${activeNode + 1}/confirm`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (res.requires_confirmation) {
      Modal.confirm({
        title: '确认重新选择该节点？',
        content: '该节点之后的内容将会被清除，需要重新生成并确认。',
        okText: '清除并确认',
        cancelText: '取消',
        onOk: () => confirmSelectedCard(true, card),
      })
      return
    }
    setEditOpen(false)
    setEditedCard(null)
    setAiInstruction('')
    setAiReply('')
    setWritingContent('')
    setWritingDirty(false)
    setReports([])
    setActiveNode((value) => Math.min(value + 1, 3))
    await loadUserData()
    await loadNodes(activeNovel.id)
  }

  const streamChatEdit = async () => {
    if (!activeNovel || !editedCard || !aiInstruction.trim()) {
      messageApi.warning('请先输入调整要求')
      return
    }
    setAiReply('')
    const res = await fetch(`${API}/novels/${activeNovel.id}/nodes/${activeNode + 1}/chat-edit`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        message: aiInstruction,
        current_card: editedCard,
        scope: editScope,
        field: editField,
      }),
    })
    if (!res.ok) {
      messageApi.error('AI 修改失败')
      return
    }
    const reader = res.body?.getReader()
    if (!reader) return
    const decoder = new TextDecoder()
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      const lines = text.split('\n').filter((line) => line.startsWith('data: '))
      for (const line of lines) {
        const data = JSON.parse(line.replace('data: ', ''))
        if (data.text) setAiReply((current) => `${current}${data.text}\n`)
        if (data.updated_card) {
          const nextCard = data.updated_card as Candidate
          setEditedCard(nextCard)
          setSelectedCard(nextCard)
          setCards((rows) => rows.map((item) => (item.id === nextCard.id ? nextCard : item)))
          setAiInstruction('')
          messageApi.success('AI 修改已应用到内容模块')
        }
      }
    }
  }

  const generateWriting = async (force = false) => {
    if (!activeNovel) return
    if (!canOpenNode(3)) {
      messageApi.warning(firstLockedReason(3))
      return
    }
    if (activeNovel.final_content && !force) {
      setWritingContent(activeNovel.final_content)
      setWritingProgress({ percent: 100, message: '已加载已保存正文' })
      return
    }
    setWritingLoading(true)
    setWritingContent('')
    setWritingDirty(false)
    setWritingProgress({ percent: 0, message: '正在准备正文生成' })
    const res = await fetch(`${API}/novels/${activeNovel.id}/writing/generate${force ? '?force=true' : ''}`, { method: 'POST', headers: authHeaders })
    const reader = res.body?.getReader()
    if (!reader) {
      setWritingLoading(false)
      return
    }
    const decoder = new TextDecoder()
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      const lines = text.split('\n').filter((line) => line.startsWith('data: '))
      for (const line of lines) {
        const data = JSON.parse(line.replace('data: ', ''))
        if (data.error) {
          messageApi.error(data.error)
          setWritingProgress({ percent: 0, message: '正文生成失败，请稍后重试' })
          setWritingLoading(false)
          return
        }
        if (data.percent) setWritingProgress({ percent: data.percent, message: data.message || '生成中' })
        if (data.content) {
          setWritingContent(data.content)
          setWritingDirty(false)
          setWritingProgress({ percent: 100, message: '正文与评审已完成' })
          await loadNovelDetail(activeNovel.id)
        }
      }
    }
    setWritingLoading(false)
  }

  const loadNovelDetail = async (id: string) => {
    const detail = await api<Novel & { reports: Report[] }>(`/novels/${id}`)
    setReports(detail.reports || [])
    setActiveNovel(detail)
    setWritingContent(detail.final_content || '')
    setChapterTitle(detail.title || '')
    setWritingDirty(false)
  }

  const runReview = async () => {
    if (!activeNovel) return
    if (writingDirty) await saveWriting(true, false)
    const report = await api<Report>(`/novels/${activeNovel.id}/review`, {
      method: 'POST',
      body: JSON.stringify({ content: writingContent || activeNovel.final_content }),
    })
    setReports((rows) => [report, ...rows])
    messageApi.success('已生成新的评审报告')
  }

  const saveWriting = async (silent = false, confirmComplete = true) => {
    if (!activeNovel) return
    const updated = await api<Novel>(`/novels/${activeNovel.id}/writing`, {
      method: 'PUT',
      body: JSON.stringify({ content: writingContent, title: chapterTitle, confirm_complete: confirmComplete }),
    })
    setActiveNovel(updated)
    setWritingDirty(false)
    await loadNodes(updated.id)
    await loadUserData()
    if (!silent) messageApi.success(confirmComplete ? '正文已确认保存' : '正文草稿已保存')
  }

  useEffect(() => {
    if (!activeNovel || activeNode !== 3 || !writingDirty || !writingContent) return
    const timer = window.setTimeout(() => {
      saveWriting(true, false).catch(() => messageApi.error('自动保存失败'))
    }, 30000)
    return () => window.clearTimeout(timer)
  }, [activeNovel?.id, activeNode, writingContent, chapterTitle, writingDirty])

  const updateWritingContent = (value: string) => {
    setUndoStack((items) => [...items.slice(-20), writingContent])
    setRedoStack([])
    setWritingContent(value)
    setWritingDirty(true)
  }

  const undoWriting = () => {
    const previous = undoStack[undoStack.length - 1]
    if (previous === undefined) return
    setRedoStack((items) => [writingContent, ...items.slice(0, 20)])
    setUndoStack((items) => items.slice(0, -1))
    setWritingContent(previous)
    setWritingDirty(true)
  }

  const redoWriting = () => {
    const next = redoStack[0]
    if (next === undefined) return
    setUndoStack((items) => [...items.slice(-20), writingContent])
    setRedoStack((items) => items.slice(1))
    setWritingContent(next)
    setWritingDirty(true)
  }

  const copyText = async (textValue: string, label: string) => {
    await navigator.clipboard.writeText(textValue)
    messageApi.success(`${label}已复制`)
  }

  const optimizeChapterTitle = () => {
    const base = activeNovel?.title || '短篇小说'
    setChapterTitle(chapterTitle.trim() ? `${chapterTitle.trim()} · 反转版` : `${base} 第一章`)
    setWritingDirty(true)
  }

  const updateEditedField = (key: string, value: unknown) => {
    setEditedCard((current) => {
      if (!current) return current
      const next = { ...current, [key]: value } as Candidate
      next.detail = cardModuleDetail(activeNode, next)
      return next
    })
  }

  const updateOutlinePart = (index: number, key: keyof OutlinePart, value: string) => {
    setEditedCard((current) => {
      if (!current) return current
      const baseOutline = Array.isArray(current.five_part_outline) ? current.five_part_outline : []
      const outline = Array.from({ length: 5 }, (_, idx) => ({ ...(baseOutline[idx] || { part: `第 ${idx + 1} 段` }) }))
      outline[index] = { ...outline[index], [key]: key === 'sub_events' ? value.split('\n').filter(Boolean) : value }
      const next = { ...current, five_part_outline: outline } as Candidate
      next.detail = cardModuleDetail(activeNode, next)
      return next
    })
  }

  const updateObjectField = (moduleKey: string, fieldKey: string, value: string) => {
    setEditedCard((current) => {
      if (!current) return current
      const object = objectValue((current as Record<string, unknown>)[moduleKey])
      const next = { ...current, [moduleKey]: { ...object, [fieldKey]: value } } as Candidate
      next.detail = cardModuleDetail(activeNode, next)
      return next
    })
  }

  const renderObjectEditor = (moduleKey: string, fields: string[]) => {
    const object = objectValue((editedCard as Record<string, unknown>)[moduleKey])
    return (
      <Row gutter={[12, 12]}>
        {fields.map((field) => (
          <Col xs={24} key={field}>
            <Form.Item label={fieldLabelMap[field] || field} className="compact-form-item">
              <TextArea
                rows={field === 'clues' || field === 'key_characters' ? 4 : 2}
                value={Array.isArray(object[field]) ? (object[field] as unknown[]).join('\n') : String(object[field] || '')}
                onChange={(event) => updateObjectField(moduleKey, field, event.target.value)}
              />
            </Form.Item>
          </Col>
        ))}
      </Row>
    )
  }

  const renderLooseObjectEditor = (moduleKey: string) => {
    const raw = (editedCard as Record<string, unknown>)[moduleKey]
    const object = objectValue(raw)
    const keys = Object.keys(object)
    if (!keys.length || (keys.length === 1 && keys[0] === 'content')) {
      return <TextArea rows={5} value={moduleText(raw)} onFocus={() => setEditField(moduleKey)} onChange={(e) => updateEditedField(moduleKey, e.target.value)} />
    }
    return (
      <Row gutter={[12, 12]}>
        {keys.map((key) => (
          <Col xs={24} key={key}>
            <Form.Item label={fieldLabelMap[key] || key} className="compact-form-item">
              <TextArea rows={2} value={moduleText(object[key])} onChange={(event) => updateObjectField(moduleKey, key, event.target.value)} />
            </Form.Item>
          </Col>
        ))}
      </Row>
    )
  }

  const renderModuleEditor = () => {
    if (!editedCard) return <Empty description="请选择候选卡" />
    if (activeNode === 2) {
      const outline = Array.isArray(editedCard.five_part_outline) ? editedCard.five_part_outline : []
      return (
        <Space direction="vertical" size={12} className="full-width">
          {Array.from({ length: 5 }, (_, index) => outline[index] || { part: `第 ${index + 1} 段` }).map((part, index) => (
            <Card size="small" title={part.part || `第 ${index + 1} 段`} key={index} extra={<Button size="small" onClick={() => { setEditField(`five_part_outline:${index}`); setEditScope('field') }}>调整本模块</Button>}>
              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}><Form.Item label="结构段名称" tooltip="这一段在五段结构中的位置，例如开头、铺垫、升级、反转、结尾。" className="compact-form-item"><Input value={part.part || ''} onChange={(e) => updateOutlinePart(index, 'part', e.target.value)} /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item label="目标字数" tooltip="这一段建议承担的字数比例，用于控制正文节奏。" className="compact-form-item"><Input value={String(part.word_target || '')} onChange={(e) => updateOutlinePart(index, 'word_target', e.target.value)} /></Form.Item></Col>
                <Col xs={24}><Form.Item label="主事件" tooltip="这一段最重要的剧情推进，必须服务反转和情绪变化。" className="compact-form-item"><TextArea rows={2} value={part.main_event || ''} onChange={(e) => updateOutlinePart(index, 'main_event', e.target.value)} /></Form.Item></Col>
                <Col xs={24}><Form.Item label="子事件" tooltip="辅助主事件的小动作、小冲突或线索，每行一条。" className="compact-form-item"><TextArea rows={2} value={Array.isArray(part.sub_events) ? part.sub_events.join('\n') : String(part.sub_events || '')} onChange={(e) => updateOutlinePart(index, 'sub_events', e.target.value)} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="情绪作用" tooltip="这一段希望读者产生的情绪变化。" className="compact-form-item"><Input value={part.emotion || ''} onChange={(e) => updateOutlinePart(index, 'emotion', e.target.value)} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="结尾钩子" tooltip="段尾留下的悬念、问题或期待。" className="compact-form-item"><Input value={part.hook || ''} onChange={(e) => updateOutlinePart(index, 'hook', e.target.value)} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="伏笔/线索" tooltip="后文反转需要回收的信息点。" className="compact-form-item"><Input value={part.clue || ''} onChange={(e) => updateOutlinePart(index, 'clue', e.target.value)} /></Form.Item></Col>
              </Row>
            </Card>
          ))}
          <Card size="small" title="反转与伏笔检查" extra={<Button size="small" onClick={() => { setEditField('logic_check'); setEditScope('field') }}>调整本模块</Button>}>
            {renderLooseObjectEditor('logic_check')}
          </Card>
        </Space>
      )
    }
    return (
      <Space direction="vertical" size={12} className="full-width">
        {(nodeModules[activeNode] || []).map((item) => (
          <Card size="small" title={item.label} key={item.key} extra={<Button size="small" onClick={() => { setEditField(item.key); setEditScope('field') }}>调整本模块</Button>}>
            {activeNode === 1 && item.key === 'core_reversal' ? renderObjectEditor(item.key, ['reversal_type', 'reversal_content', 'clues']) :
              activeNode === 1 && item.key === 'emotion_curve' ? renderObjectEditor(item.key, ['opening', 'middle', 'reversal', 'ending']) :
                activeNode === 1 && item.key === 'character_sketch' ? renderObjectEditor(item.key, ['protagonist', 'key_characters', 'relationship']) :
                  <TextArea
                    rows={item.key === 'logline' ? 3 : 6}
                    value={moduleText((editedCard as Record<string, unknown>)[item.key])}
                    onFocus={() => setEditField(item.key)}
                    onChange={(event) => updateEditedField(item.key, event.target.value)}
                  />}
          </Card>
        ))}
      </Space>
    )
  }

  const currentModuleOptions = useMemo(() => {
    if (activeNode === 2 && editedCard?.five_part_outline?.length) {
      return [
        ...editedCard.five_part_outline.map((part, index) => ({ label: part.part || `第 ${index + 1} 段`, value: `five_part_outline:${index}` })),
        { label: '反转与伏笔检查', value: 'logic_check' },
      ]
    }
    return (nodeModules[activeNode] || []).map((item) => ({ label: item.label, value: item.key }))
  }, [activeNode, editedCard])
  const stepItems = useMemo(() => {
    const icons = [<RobotOutlined />, <EditOutlined />, <FileTextOutlined />, <ReadOutlined />]
    return flowItems.map((item, index) => ({
      title: isMobile ? <Tooltip title={canOpenNode(index) ? item.description : firstLockedReason(index)}><span>{item.title}</span></Tooltip> : item.title,
      description: isMobile ? undefined : item.description,
      icon: icons[index],
      disabled: !canOpenNode(index),
    }))
  }, [isMobile, nodeStates])

  const summarizedReport = useMemo(() => {
    if (!reports.length) return null
    const orderedReports = [...reports].sort((a, b) => a.round_no - b.round_no)
    const latest = orderedReports[orderedReports.length - 1]
    const scoreKeys = Array.from(new Set(orderedReports.flatMap((item) => Object.keys(item.report.scores || {}))))
    const scores = Object.fromEntries(scoreKeys.map((key) => {
      const values = orderedReports.map((item) => item.report.scores?.[key]).filter((value): value is number => typeof value === 'number')
      return [key, values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0]
    }))
    const issues = orderedReports.flatMap((item) => item.report.issues || [])
    return {
      ...latest,
      report: {
        ...latest.report,
        summary: orderedReports.length > 1 ? orderedReports.map((item) => `第${item.round_no}次：${item.report.summary}`).join('\n') : latest.report.summary,
        scores,
        issues,
      },
    }
  }, [reports])

  const openReviewReport = () => {
    if (!summarizedReport) return
    Modal.info({
      title: '综合评审报告',
      width: 820,
      content: (
        <Space direction="vertical" size={16} className="full-width">
          <Card size="small" title="评审结果">
            <pre className="snapshot-box">{JSON.stringify(summarizedReport.report, null, 2)}</pre>
          </Card>
          <Card size="small" title="评审快照">
            <pre className="snapshot-box">{summarizedReport.source_snapshot}</pre>
          </Card>
        </Space>
      ),
    })
  }

  const renderWritingEditor = () => (
    <div className="writing-editor-shell">
      <div className="writing-title-row">
        <Input className="chapter-pill" value="第 1 章" readOnly />
        <Select className="volume-select" value="第1卷" options={[{ label: '第1卷', value: '第1卷' }]} />
        <Input
          className="chapter-title-input"
          value={chapterTitle}
          placeholder="输入章节标题"
          onChange={(event) => {
            setChapterTitle(event.target.value)
            setWritingDirty(true)
          }}
        />
        <Button icon={<RobotOutlined />} type="primary" ghost onClick={optimizeChapterTitle}>优化标题</Button>
      </div>
      <div className="writing-toolbar">
        <Tooltip title="撤销上一次正文修改"><Button icon={<HistoryOutlined />} onClick={undoWriting} disabled={!undoStack.length}>撤销</Button></Tooltip>
        <Tooltip title="恢复已撤销的正文"><Button icon={<ReloadOutlined />} onClick={redoWriting} disabled={!redoStack.length}>恢复</Button></Tooltip>
        <Button icon={<CopyOutlined />} onClick={() => copyText(chapterTitle, '标题')}>复制标题</Button>
        <Button icon={<CopyOutlined />} onClick={() => copyText(writingContent, '正文')}>复制正文</Button>
        <Button icon={<RobotOutlined />} onClick={() => messageApi.info('智能排版会在下一步接入格式化服务')}>智能排版</Button>
        <Button icon={<SoundOutlined />} onClick={() => messageApi.info('听书能力待接入语音服务')}>听书</Button>
        <Button icon={<BookOutlined />} onClick={() => messageApi.info('高频词分析待接入文本分析服务')}>高频词</Button>
        <Button icon={<EditOutlined />} onClick={() => messageApi.info('替换能力待接入编辑器选区')}>替换</Button>
        <Button icon={<HistoryOutlined />} onClick={() => messageApi.info('历史版本会读取自动保存记录')}>历史</Button>
        <Button danger icon={<DeleteOutlined />} onClick={() => Modal.confirm({
          title: '确认清空正文？',
          content: '清空后会作为未保存修改保留在当前编辑器中，确认保存前不会覆盖数据库。',
          okText: '清空',
          cancelText: '取消',
          onOk: () => updateWritingContent(''),
        })}>清空</Button>
      </div>
      {writingLoading && !writingContent ? (
        <Spin tip="正在生成正文，请稍候"><div className="loading-panel" /></Spin>
      ) : (
        <TextArea
          className="writing-main-input"
          value={writingContent}
          placeholder="正文生成后会出现在这里，也可以直接输入或修改。"
          onChange={(event) => updateWritingContent(event.target.value)}
        />
      )}
      <div className="writing-editor-footer">
        <Text type="secondary">字数 {writingContent.length} · {writingDirty ? '30 秒无输入后自动保存草稿' : '已保存'} · 内容由 AI 辅助生成</Text>
        <Button className="floating-ai-button" shape="circle" icon={<RobotOutlined />} onClick={() => generateWriting(true)} />
      </div>
    </div>
  )

  const renderSettingData = () => {
    const topic = nodeStates.find((item) => item.index === 1)?.selected_card_data
    const framework = nodeStates.find((item) => item.index === 2)?.selected_card_data
    const outline = nodeStates.find((item) => item.index === 3)?.selected_card_data
    const character = objectValue(framework?.character_sketch)
    const emotionCurve = objectValue(framework?.emotion_curve)
    const reversal = objectValue(framework?.core_reversal)
    return (
      <Space direction="vertical" size={16} className="full-width">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="人物">
              {Object.keys(character).length ? (
                <Space direction="vertical" className="full-width">
                  {Object.entries(character).map(([key, value]) => <Paragraph key={key}><Text strong>{fieldLabelMap[key] || key}：</Text>{moduleText(value)}</Paragraph>)}
                </Space>
              ) : <Empty description="确认核心框架后生成角色设定" />}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="世界观">
              {topic?.setting ? <Paragraph>{moduleText(topic.setting)}</Paragraph> : <Empty description="确认定题材后生成世界观" />}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="人物状态与情绪">
              {Object.keys(emotionCurve).length ? (
                <Space direction="vertical" className="full-width">
                  {Object.entries(emotionCurve).map(([key, value]) => <Paragraph key={key}><Text strong>{fieldLabelMap[key] || key}：</Text>{moduleText(value)}</Paragraph>)}
                </Space>
              ) : <Empty description="确认核心框架后生成情绪曲线" />}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="反转与线索">
              {Object.keys(reversal).length || outline?.logic_check ? (
                <Space direction="vertical" className="full-width">
                  {Object.entries(reversal).map(([key, value]) => <Paragraph key={key}><Text strong>{fieldLabelMap[key] || key}：</Text>{moduleText(value)}</Paragraph>)}
                  {outline?.logic_check && <Paragraph><Text strong>伏笔检查：</Text>{moduleText(outline.logic_check)}</Paragraph>}
                </Space>
              ) : <Empty description="确认大纲后生成反转线索" />}
            </Card>
          </Col>
        </Row>
      </Space>
    )
  }

  const renderHome = () => (
    <Layout className="public-shell">
      <Header className="public-header">
        <button className="brand-button" onClick={() => setScreen('home')}><RobotOutlined />短篇小说生成</button>
        <Button type="primary" onClick={() => setScreen('login')}>手机号登录</Button>
      </Header>
      <Content className="home-content">
        <section className="home-hero">
          <div>
            <Tag color="blue">浏览器端 AI 短篇写作平台</Tag>
            <Title>把短篇小说写作，拆成可以一步步确认的流程</Title>
            <Paragraph>从题材、框架、大纲到正文，用户每一步都能选择、修改、重试。正文完成后，平台自动进行三轮评审，并保留每次评审报告。</Paragraph>
            <Space>
              <Button type="primary" size="large" onClick={() => setScreen('login')} icon={<PhoneOutlined />}>用手机号开始</Button>
              <Button size="large" onClick={() => setScreen('login')}>继续写作</Button>
            </Space>
          </div>
          <Card className="home-preview" title="写作流程预览">
            <Steps direction="vertical" current={1} items={flowItems} />
          </Card>
        </section>
      </Content>
    </Layout>
  )

  const renderLogin = () => (
    <Layout className="auth-layout">
      <Card className="auth-card">
        <Space direction="vertical" size={18} className="full-width">
          <button className="brand-button" onClick={() => setScreen('home')}><RobotOutlined />短篇小说生成</button>
          <div>
            <Title level={2}>手机号登录</Title>
            <Text type="secondary">体验版验证码为 123456，可使用测试号 13900000001。</Text>
          </div>
          <Form layout="vertical" onFinish={login}>
            <Form.Item label="手机号">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} prefix={<PhoneOutlined />} />
            </Form.Item>
            <Form.Item label="验证码">
              <Space.Compact className="full-width">
                <Input value={code} onChange={(e) => setCode(e.target.value)} />
                <Button onClick={sendCode}>发送验证码</Button>
              </Space.Compact>
            </Form.Item>
            <Button block type="primary" htmlType="submit" icon={<LoginOutlined />}>登录</Button>
          </Form>
        </Space>
      </Card>
    </Layout>
  )

  const renderWritingList = () => (
    <Card title="写作中的文章" extra={<Button type="link" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建</Button>}>
      <List
        dataSource={writingNovels}
        locale={{ emptyText: <Empty description="暂无写作中的文章" /> }}
        renderItem={(item) => (
          <List.Item className={activeNovel?.id === item.id ? 'active-writing-row' : ''} onClick={() => { setWorkspaceMode('edit'); setActiveNovel(item); setActiveNode(0); setWritingContent(item.final_content || ''); loadNovelDetail(item.id).catch(() => messageApi.error('文章详情加载失败')) }}>
            <List.Item.Meta title={item.title} description={`${item.genre} · ${statusLabels[item.status] || item.status} · ${item.word_count}/${item.target_words} 字`} />
          </List.Item>
        )}
      />
    </Card>
  )

  const dashboardStats = useMemo(() => {
    const portfolioNovels = [...portfolio.collections.flatMap((item) => item.novels || []), ...portfolio.ungrouped]
    const allNovels = [...writingNovels, ...portfolioNovels]
    return {
      writing: writingNovels.length,
      completed: allNovels.filter((item) => item.status === 'completed').length,
      totalWords: allNovels.reduce((sum, item) => sum + (item.word_count || 0), 0),
      templates: promptTemplates.length,
    }
  }, [writingNovels, portfolio, promptTemplates])

  const renderDashboard = () => (
    <Space direction="vertical" size={16} className="full-width">
      <Card className="dashboard-hero-card">
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={3}>首页</Title>
            <Text type="secondary">欢迎回来，{user?.nickname || '创作者'}。这里是你的短篇创作看板。</Text>
          </Col>
          <Col><Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>开始新作品</Button></Col>
        </Row>
      </Card>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><Card><Text type="secondary">写作中</Text><Title level={2}>{dashboardStats.writing}</Title></Card></Col>
        <Col xs={24} md={6}><Card><Text type="secondary">已完成</Text><Title level={2}>{dashboardStats.completed}</Title></Card></Col>
        <Col xs={24} md={6}><Card><Text type="secondary">累计字数</Text><Title level={2}>{dashboardStats.totalWords}</Title></Card></Col>
        <Col xs={24} md={6}><Card><Text type="secondary">提示词模板</Text><Title level={2}>{dashboardStats.templates}</Title></Card></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="写作入口" extra={<Button type="link" onClick={() => setPage('workspace')}>进入工作台</Button>}>
            <List
              dataSource={writingNovels.slice(0, 5)}
              locale={{ emptyText: <Empty description="暂无写作中的文章" /> }}
              renderItem={(item) => (
                <List.Item actions={[<Button key="go" onClick={() => { setWorkspaceMode('edit'); setActiveNovel(item); setPage('workspace'); setWorkspaceTab('directory'); setActiveNode(3); loadNovelDetail(item.id); loadNodes(item.id) }}>继续写</Button>]}>
                  <List.Item.Meta title={item.title} description={`${item.genre} · ${statusLabels[item.status] || item.status}`} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="提示词模板库">
            <List
              dataSource={promptTemplates}
              renderItem={(item) => <List.Item><List.Item.Meta title={<Space>{item.name}{item.is_default && <Tag color="blue">默认</Tag>}</Space>} description={item.description} /></List.Item>}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  )

  const renderNodeArea = () => {
    if (!activeNovel) return <Empty description="请先创建或选择写作中的文章" />
    const currentNode = nodeStates.find((item) => item.index === activeNode + 1)
    if (workspaceMode === 'view') {
      if (activeNode === 3) {
        return (
          <Card title="正文写作 · 查看">
            {activeNovel.final_content ? <pre className="confirmed-card-detail">{activeNovel.final_content}</pre> : <Empty description="暂无正文" />}
          </Card>
        )
      }
      return (
        <Card title={`${flowItems[activeNode].title} · 查看`}>
          {currentNode?.selected_card_data ? <pre className="confirmed-card-detail">{cardModuleDetail(activeNode, currentNode.selected_card_data)}</pre> : <Empty description="该节点暂无确认内容" />}
        </Card>
      )
    }
    if (!canOpenNode(activeNode)) {
      return (
        <Card title={flowItems[activeNode].title}>
          <Empty description={firstLockedReason(activeNode)} />
        </Card>
      )
    }
    if (activeNode === 3) {
      return (
        <Space direction="vertical" size={16} className="full-width">
          {(writingLoading || writingProgress.percent > 0) && (
            <Card title="正文生成进度">
              <Progress percent={writingProgress.percent} />
              <Text>{writingProgress.message}</Text>
            </Card>
          )}
          <Card
            title="作品目录"
            className="writing-directory-card"
            extra={<Space wrap><Button onClick={() => generateWriting(true)} icon={<ReloadOutlined />}>重新生成正文</Button><Button icon={<SaveOutlined />} onClick={() => saveWriting(false, true)} disabled={!writingContent}>确认保存正文</Button><Button type="primary" onClick={runReview} disabled={!writingContent}>再次评审</Button></Space>}
          >
            {renderWritingEditor()}
          </Card>
          {writingContent && summarizedReport && (
            <Card title="评审报告">
              <List.Item>
                <List.Item.Meta title="综合评审报告" description={<Space direction="vertical"><Text>{summarizedReport.report.summary}</Text><Button onClick={openReviewReport}>查看评审快照和结果</Button></Space>} />
              </List.Item>
            </Card>
          )}
        </Space>
      )
    }
    if (currentNode?.status === 'confirmed' && currentNode.selected_card_data) {
      const confirmed = currentNode.selected_card_data
      return (
        <Card
          title={`${flowItems[activeNode].title} · 已确认`}
          extra={<Space><Button onClick={() => openEditCard(confirmed)} icon={<EditOutlined />}>编辑确认内容</Button><Button onClick={refreshCards} icon={<ReloadOutlined />}>重新选择方案</Button></Space>}
        >
          <Space direction="vertical" size={12} className="full-width">
            <Text type="secondary">重新进入已确认节点时，不会再次自动生成候选卡。</Text>
            <Card size="small" title={confirmed.title} extra={<Tag color="green">已确认</Tag>}>
              <Paragraph>{confirmed.summary}</Paragraph>
              <pre className="confirmed-card-detail">{cardModuleDetail(activeNode, confirmed)}</pre>
            </Card>
          </Space>
        </Card>
      )
    }
    return (
      <Card title={`${flowItems[activeNode].title}候选`} extra={<Button icon={<ReloadOutlined />} onClick={refreshCards} loading={cardsLoading}>换一批</Button>}>
        {cardsLoading ? (
          <Spin tip="AI 正在生成 3 张候选卡，节点内容越复杂耗时越久。">
            <div className="loading-panel" />
          </Spin>
        ) : (
          <Row gutter={[16, 16]}>
            {cards.map((card) => (
              <Col xs={24} md={8} key={card.id}>
                <Card
                  hoverable
                  onClick={() => openEditCard(card)}
                  className={selectedCard?.id === card.id ? 'candidate-card selected' : 'candidate-card'}
                  title={card.title}
                  extra={<Tag color="blue">{card.emotion}</Tag>}
                  actions={[
                    <CheckCircleOutlined key="confirm" onClick={(event) => { event.stopPropagation(); confirmSelectedCard(false, card) }} />,
                  ]}
                >
                  <Paragraph>{card.summary}</Paragraph>
                  <Space wrap>{card.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    )
  }

  const renderWorkspace = () => (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={6}>{renderWritingList()}</Col>
      <Col xs={24} lg={18}>
        <Space direction="vertical" size={16} className="full-width">
          <Card>
            <Row justify="space-between" align="middle" gutter={[16, 16]}>
              <Col><Title level={3}>{activeNovel?.title || '写作工作台'}</Title><Text type="secondary">{workspaceMode === 'view' ? '查看模式 · 只读浏览' : activeNovel?.pipeline_mode === 'auto' ? '自动写小说 · 按节点自动推进' : '手动节点模式 · 可回退重选'}</Text></Col>
              <Col><Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建小说</Button></Col>
            </Row>
            <Tabs
              activeKey={workspaceTab}
              onChange={(key) => {
                const next = key as 'info' | 'directory' | 'settings'
                setWorkspaceTab(next)
                if (next === 'directory') setActiveNode(3)
                if (next === 'info' && activeNode > 2) setActiveNode(0)
              }}
              items={[
                { key: 'info', label: '作品信息' },
                { key: 'directory', label: '作品目录' },
                { key: 'settings', label: '设定数据' },
              ]}
            />
            {workspaceTab === 'info' && (
              <Steps
                className="workspace-steps"
                current={Math.min(activeNode, 2)}
                items={stepItems.slice(0, 3)}
                onChange={(index) => {
                  if (!canOpenNode(index)) {
                    messageApi.warning(firstLockedReason(index))
                    return
                  }
                  setActiveNode(index)
                }}
                responsive={!isMobile}
              />
            )}
          </Card>
          {(autoRunning || autoProgress.length > 0) && (
            <Card title="自动写作流程" extra={autoRunning ? <Tag color="processing">运行中</Tag> : <Tag color="success">已结束</Tag>}>
              <List
                dataSource={autoProgress}
                renderItem={(item) => <List.Item><List.Item.Meta title={`节点 ${item.node}`} description={item.message} /></List.Item>}
              />
            </Card>
          )}
          {workspaceTab === 'settings' ? renderSettingData() : renderNodeArea()}
        </Space>
      </Col>
    </Row>
  )

  const portfolioNovels = [...portfolio.collections.flatMap((c) => c.novels || []), ...portfolio.ungrouped]
  const portfolioActions = (novel: Novel) => (
    <Space wrap>
      <Button size="small" onClick={() => openNovelWorkspace(novel, 'edit')}>编辑</Button>
      <Button size="small" onClick={() => openNovelWorkspace(novel, 'view')}>查看</Button>
      <Button size="small" onClick={() => { setActiveNovel(novel); setScreen('reader'); loadNovelDetail(novel.id) }}>阅读</Button>
      <Button size="small" danger onClick={() => discardNovel(novel)}>废弃</Button>
    </Space>
  )
  const portfolioCardItem = (novel: Novel, icon: ReactNode) => (
    <List.Item>
      <div className="portfolio-card-item">
        <List.Item.Meta avatar={<Avatar icon={icon} />} title={novel.title} description={`${novel.genre} · ${statusLabels[novel.status] || novel.status} · ${novel.word_count} 字`} />
        <div className="portfolio-card-actions">{portfolioActions(novel)}</div>
      </div>
    </List.Item>
  )
  const renderPortfolio = () => (
    <Space direction="vertical" size={16} className="full-width">
      <Card>
        <Row justify="space-between" align="middle">
          <Col><Title level={3}>作品集</Title><Text type="secondary">优先按合集展示，未归档作品单独展示。</Text></Col>
          <Col><Segmented value={collectionView} onChange={(v) => setCollectionView(v as 'card' | 'list')} options={[{ label: '卡片', value: 'card' }, { label: '列表', value: 'list' }]} /></Col>
        </Row>
      </Card>
      {collectionView === 'card' ? (
        <Row gutter={[16, 16]}>
          {portfolio.collections.map((collection) => (
            <Col xs={24} md={12} xl={8} key={collection.id}>
              <Card title={collection.name}>
                <List dataSource={collection.novels || []} renderItem={(novel) => portfolioCardItem(novel, <BookOutlined />)} />
              </Card>
            </Col>
          ))}
          <Col xs={24} md={12} xl={8}>
            <Card title="未归档作品">
              <List dataSource={portfolio.ungrouped} renderItem={(novel) => portfolioCardItem(novel, <FileTextOutlined />)} />
            </Card>
          </Col>
        </Row>
      ) : (
        <Card>
          <Table
            dataSource={portfolioNovels}
            rowKey="id"
            columns={[
              { title: '作品', dataIndex: 'title' },
              { title: '题材', dataIndex: 'genre' },
              { title: '字数', dataIndex: 'word_count' },
              { title: '状态', dataIndex: 'status', render: (status: string) => statusLabels[status] || status },
              { title: '操作', render: (_, novel: Novel) => portfolioActions(novel) },
            ]}
          />
        </Card>
      )}
    </Space>
  )

  const renderReader = () => (
    <Layout className="app-layout">
      <Header className="app-header"><button className="brand-button" onClick={() => { setScreen('app'); setPage('portfolio') }}><ReadOutlined />返回作品集</button></Header>
      <Content className="reader-page">
        <article className="reader-paper">
          <Title>{activeNovel?.title}</Title>
          <Text type="secondary">{activeNovel?.genre} · {activeNovel?.word_count} 字</Text>
          <Divider />
          {(activeNovel?.final_content || '').split('\n').map((line, idx) => line ? <p key={idx}>{line}</p> : <br key={idx} />)}
        </article>
      </Content>
    </Layout>
  )

  const renderSettings = () => (
    <Layout className="app-layout">
      <AppHeader />
      <Content className="app-content">
        <Card title="设置">
          <Tabs items={[
            { key: 'profile', label: '个人资料', children: <Form layout="vertical" initialValues={{ nickname: user?.nickname }} onFinish={saveProfile}><Form.Item label="昵称" name="nickname" rules={[{ required: true, message: '请输入昵称' }]}><Input /></Form.Item><Button type="primary" htmlType="submit">保存</Button></Form> },
            { key: 'model', label: 'Pro 模型', children: <Form layout="vertical"><Form.Item label="供应商"><Select defaultValue="deepseek" options={[{ label: 'DeepSeek', value: 'deepseek' }]} /></Form.Item><Form.Item label="API Key"><Input.Password /></Form.Item><Button type="primary">测试连接</Button></Form> },
          ]} />
        </Card>
      </Content>
    </Layout>
  )

  const openNovelWorkspace = async (novel: Novel, mode: 'edit' | 'view') => {
    setWorkspaceMode(mode)
    setActiveNovel(novel)
    const shouldOpenWriting = Boolean(novel.final_content) || ['writing_done', 'completed'].includes(novel.status)
    setActiveNode(shouldOpenWriting ? 3 : 0)
    setWorkspaceTab(shouldOpenWriting ? 'directory' : 'info')
    setScreen('app')
    setPage('workspace')
    await loadNovelDetail(novel.id)
    await loadNodes(novel.id)
  }

  const discardNovel = async (novel: Novel) => {
    Modal.confirm({
      title: '确认废弃作品？',
      content: '废弃后将不再在作品集展示。',
      okText: '确认废弃',
      cancelText: '取消',
      onOk: async () => {
        await api(`/novels/${novel.id}/discard`, { method: 'POST' })
        await loadUserData()
        messageApi.success('作品已废弃')
      },
    })
  }

  const AppHeader = () => (
    <Header className="app-header">
      <button className="brand-button" onClick={() => { setScreen('app'); setPage('dashboard') }}><RobotOutlined />短篇小说生成</button>
      <Dropdown menu={{ items: [{ key: 'settings', icon: <SettingOutlined />, label: '设置', onClick: () => setScreen('settings') }, { key: 'logout', icon: <LogoutOutlined />, label: '退出', onClick: logout }] }}>
        <Button type="text"><Avatar icon={<UserOutlined />} /> {user?.nickname || '用户'} <DownOutlined /></Button>
      </Dropdown>
    </Header>
  )

  const renderDiscover = () => (
    <Card title="发现">
      <Table
        rowKey="id"
        dataSource={platforms}
        columns={[
          { title: '平台', dataIndex: 'name' },
          { title: '适合条件', dataIndex: 'fit' },
          { title: '格式要求', dataIndex: 'format_note' },
          { title: '投稿指南', dataIndex: 'guide' },
        ]}
        pagination={false}
      />
    </Card>
  )

  const pageTitleMap: Record<Page, string> = { dashboard: '首页', workspace: '写作工作台', portfolio: '作品集', discover: '发现' }
  const pageContent = page === 'dashboard' ? renderDashboard() : page === 'workspace' ? renderWorkspace() : page === 'portfolio' ? renderPortfolio() : renderDiscover()
  const renderApp = () => (
    <Layout className="app-layout">
      <AppHeader />
      <Layout>
        <Sider className="app-sider" width={220}>
          <Menu selectedKeys={[page]} onClick={({ key }) => setPage(key as Page)} items={[
            { key: 'dashboard', icon: <HomeOutlined />, label: '首页' },
            { key: 'workspace', icon: <EditOutlined />, label: '写作工作台' },
            { key: 'portfolio', icon: <FolderOpenOutlined />, label: '作品集' },
            { key: 'discover', icon: <BookOutlined />, label: '发现' },
          ]} />
        </Sider>
        <Content className="app-content">
          <Breadcrumb items={[{ title: <HomeOutlined /> }, { title: pageTitleMap[page] }]} />
          <div className="mobile-tabs">
            <Segmented block value={page} onChange={(v) => setPage(v as Page)} options={[{ label: '首页', value: 'dashboard' }, { label: '写作', value: 'workspace' }, { label: '作品', value: 'portfolio' }, { label: '发现', value: 'discover' }]} />
          </div>
          <div className="content-body">{pageContent}</div>
        </Content>
      </Layout>
    </Layout>
  )

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1677ff', borderRadius: 6 } }}>
      {contextHolder}
      {screen === 'home' && renderHome()}
      {screen === 'login' && renderLogin()}
      {screen === 'app' && renderApp()}
      {screen === 'settings' && renderSettings()}
      {screen === 'reader' && renderReader()}
      <Drawer title={selectedCard?.title} open={editOpen} onClose={() => setEditOpen(false)} width={920} extra={<Button type="primary" onClick={() => editedCard && confirmSelectedCard(false, editedCard)}>确认修改</Button>}>
        <Row gutter={[16, 16]} className="node-editor">
          <Col xs={24} lg={15}>
            <Space direction="vertical" className="full-width" size={12}>
              <Text type="secondary">每个模块都可以直接编辑，确认后会按当前结构保存。</Text>
              {renderModuleEditor()}
            </Space>
          </Col>
          <Col xs={24} lg={9}>
            <Card title="AI 调整" size="small" className="ai-edit-card">
              <Space direction="vertical" className="full-width" size={12}>
                <Text type="secondary">您也可以直接在左侧编辑区人为修改内容。</Text>
                <Radio.Group value={editScope} onChange={(event) => setEditScope(event.target.value)}>
                  <Radio.Button value="field">当前模块</Radio.Button>
                  <Radio.Button value="card">整张卡片</Radio.Button>
                </Radio.Group>
                <Select disabled={editScope === 'card'} value={editField} options={currentModuleOptions} onChange={setEditField} />
                <TextArea rows={5} value={aiInstruction} onChange={(event) => setAiInstruction(event.target.value)} placeholder="例如：让冲突更尖锐，但保持克制，不要狗血。" />
                <Button type="primary" icon={<MessageOutlined />} onClick={streamChatEdit} block>让 AI 调整并应用</Button>
                <pre className="ai-stream-box">{aiReply || 'AI 的修改过程会显示在这里，完成后会自动写回模块。'}</pre>
              </Space>
            </Card>
          </Col>
        </Row>
      </Drawer>
      <Modal title="新建小说" open={createOpen} onCancel={() => setCreateOpen(false)} footer={null}>
        <Form layout="vertical" initialValues={{ target_words: 10000, genre: '现实反转', pipeline_mode: 'manual', prompt_template_id: 'oh-story' }} onFinish={createNovel}>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}><Input /></Form.Item>
          <Form.Item label="合集" name="collection_id"><Select allowClear placeholder="选择合集" options={collections.map((c) => ({ label: c.name, value: c.id }))} /></Form.Item>
          <Form.Item label="提示词模板库" name="prompt_template_id">
            <Select options={promptTemplates.map((item) => ({ label: item.is_default ? `${item.name}（默认）` : item.name, value: item.id, title: item.description }))} />
          </Form.Item>
          <Form.Item label="题材" name="genre">
            <Radio.Group className="genre-card-group">
              <Row gutter={[12, 12]}>
                {genreCards.map((item) => (
                  <Col xs={24} md={8} key={item.genre}>
                    <Radio.Button value={item.genre} className="genre-card-button">
                      <strong>{item.title}</strong>
                      <span>{item.desc}</span>
                    </Radio.Button>
                  </Col>
                ))}
              </Row>
            </Radio.Group>
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => getFieldValue('pipeline_mode') === 'auto' ? (
              <Form.Item label="一句话设定" name="premise" rules={[{ required: true, message: '请输入一句话设定' }]}>
                <TextArea rows={3} placeholder="例如：一个外卖员每天给同一个空号送餐，直到某天电话真的接通了。" />
              </Form.Item>
            ) : null}
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => <Form.Item label={`目标字数：${getFieldValue('target_words') || 10000} 字`} name="target_words"><Slider min={8000} max={20000} step={500} marks={{ 8000: '8000', 10000: '10000', 20000: '20000' }} /></Form.Item>}
          </Form.Item>
          <Form.Item label="模式" name="pipeline_mode"><Radio.Group options={[{ label: '手动节点', value: 'manual' }, { label: '全自动', value: 'auto' }]} /></Form.Item>
          <Button type="primary" htmlType="submit" block>创建并开始</Button>
        </Form>
      </Modal>
    </ConfigProvider>
  )
}

export default App
