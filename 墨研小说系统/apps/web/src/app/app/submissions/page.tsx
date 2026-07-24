'use client';
import '@ant-design/v5-patch-for-react-19';
import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/AppShell';
import { Button, Card, Descriptions, message, Modal, Popconfirm, Result, Space, Steps, Tag, Typography, Alert } from 'antd';
import { SendOutlined, WechatOutlined, AuditOutlined, CheckCircleOutlined, CloseCircleOutlined, RollbackOutlined, LoadingOutlined } from '@ant-design/icons';

const API = 'http://localhost:3100/api';
async function f(path: string, m='GET', b?:any) {
  const token = localStorage.getItem('moyan_access_token');
  const r = await fetch(`${API}${path}`,{method:m,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:b?JSON.stringify(b):undefined});
  return r.json();
}

export default function SubmissionsPage() {
  const [tab, setTab] = useState<'submit'|'history'>('history');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [wechatBound, setWechatBound] = useState(false);
  const [wechatNickname, setWechatNickname] = useState('');

  useEffect(() => {
    f('/submissions/wechat-status').then(d=>{setWechatBound(d.bound);setWechatNickname(d.nickname);});
    f('/submissions/my').then(setSubmissions);
  }, []);

  const statusMap: Record<string,{color:string;label:string}> = {
    elements_packaged: {color:'default',label:'未机检'},
    machine_reviewed: {color:'processing',label:'已机检待送审'},
    pending: {color:'processing',label:'待审核'},
    reviewing: {color:'processing',label:'审核中'},
    approved: {color:'success',label:'已通过'},
    rejected: {color:'error',label:'已退回'},
    withdrawn: {color:'warning',label:'已撤回'},
  };

  return <AppShell>
    <div className="eyebrow">SUBMISSIONS</div>
    <Typography.Title level={2}>投稿中心</Typography.Title>
    <Space direction="vertical" size={12} style={{width:'100%'}}>
      {!wechatBound && <Alert type="warning" showIcon message="送审前必须绑定微信" description={<WechatForm onSubmit={async (v:any)=>{await f('/submissions/bind-wechat','POST',v);message.success('已绑定');setWechatBound(true);setWechatNickname(v.nickname||'');}} />} />}
      {wechatBound && <Alert type="success" showIcon message={`已绑定微信${wechatNickname?': '+wechatNickname:''}`} />}
      {submissions.map(s => (
        <Card key={s.id} size="small" extra={<Space>
          <Tag color={statusMap[s.status]?.color}>{statusMap[s.status]?.label}</Tag>
          {(s.status==='pending'||s.status==='reviewing') && <Popconfirm title="确定撤回？" onConfirm={async()=>{await f(`/submissions/${s.id}/withdraw`,'POST');message.success('已撤回');f('/submissions/my').then(setSubmissions);}}><Button size="small" icon={<RollbackOutlined />}>撤回</Button></Popconfirm>}
          <SubmissionDetailModal submission={s} />
        </Space>}>
          <Typography.Text strong>{s.title}</Typography.Text>
          <div><Typography.Text type="secondary">{s.drama_type} · {s.style_type} · {s.episode_count||0}集 · {new Date(s.created_at).toLocaleDateString()}</Typography.Text></div>
          {s.status==='rejected' && s.reviewer_comment && <Alert type="error" message="退回意见" description={<pre style={{whiteSpace:'pre-wrap',margin:0}}>{s.reviewer_comment}</pre>} style={{marginTop:8}} />}
        </Card>
      ))}
      {submissions.length===0 && <Typography.Text type="secondary">暂无投稿记录。请在"小说集"页面选择作品点击「送审」。</Typography.Text>}
    </Space>
  </AppShell>;
}

function WechatForm({onSubmit}:{onSubmit:(v:any)=>void}) {
  return <div style={{marginTop:8,display:'flex',gap:8}}>
    <input placeholder="微信 OpenID" onChange={e=>{(window as any).__wechat_openid=e.target.value}} style={{flex:1,padding:'4px 8px',border:'1px solid #d9d9d9',borderRadius:6}} />
    <input placeholder="昵称(可选)" onChange={e=>{(window as any).__wechat_nick=e.target.value}} style={{flex:1,padding:'4px 8px',border:'1px solid #d9d9d9',borderRadius:6}} />
    <Button icon={<WechatOutlined />} onClick={()=>onSubmit({openid:(window as any).__wechat_openid,nickname:(window as any).__wechat_nick})}>绑定</Button>
  </div>;
}

function SubmissionDetailModal({submission}:{submission:any}) {
  const [open, setOpen] = useState(false);
  return <>
    <Button size="small" onClick={()=>setOpen(true)}>详情</Button>
    <Modal title="投稿详情" open={open} onCancel={()=>setOpen(false)} footer={null} width={700}>
      <Descriptions column={2} size="small" style={{marginBottom:16}}>
        <Descriptions.Item label="标题">{submission.title}</Descriptions.Item>
        <Descriptions.Item label="状态"><Tag color={({elements_packaged:'default',machine_reviewed:'processing',pending:'processing',approved:'success',rejected:'error',reviewing:'processing',withdrawn:'warning'} as Record<string,string>)[submission.status]}>{({elements_packaged:'未机检',machine_reviewed:'已机检',pending:'待审核',approved:'通过',rejected:'退回',reviewing:'在审',withdrawn:'已撤回'} as Record<string,string>)[submission.status]}</Tag></Descriptions.Item>
        <Descriptions.Item label="类型">{submission.drama_type}</Descriptions.Item>
        <Descriptions.Item label="风格">{submission.style_type}</Descriptions.Item>
        <Descriptions.Item label="集数">{submission.episode_count||0}</Descriptions.Item>
        <Descriptions.Item label="时间">{new Date(submission.created_at).toLocaleString()}</Descriptions.Item>
      </Descriptions>
      {submission.machine_review_score && <>
        <Card title={`机检报告 - ${submission.machine_review_score}分`} size="small" style={{background:'#fafafa',marginBottom:12}}>
          <pre style={{whiteSpace:'pre-wrap',margin:0,fontSize:13}}>{submission.machine_review_report}</pre>
        </Card>
      </>}
      {submission.reviewer_comment && <Alert type="error" message="审核意见" description={<pre style={{whiteSpace:'pre-wrap',margin:0}}>{submission.reviewer_comment}</pre>} style={{marginBottom:12}} />}
      {submission.elements && <Card title="三要素" size="small" style={{background:'#fafafa'}}><pre style={{whiteSpace:'pre-wrap',margin:0,fontSize:13,maxHeight:300,overflow:'auto'}}>{submission.elements}</pre></Card>}
    </Modal>
  </>;
}

/** 送审 3 步弹窗 */
export function SubmissionWizard({ projectId, episodes, title, dramaType, styleType, onDone }: {
  projectId: string; episodes: { number: number; title: string; content: string; score: number }[];
  title: string; dramaType: string; styleType: string; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [subId, setSubId] = useState('');
  const [mrScore, setMrScore] = useState(0);
  const [mrReport, setMrReport] = useState('');
  const [elements, setElements] = useState<any>(null);
  const [wechatBound, setWechatBound] = useState(false);

  useEffect(() => { f('/submissions/wechat-status').then(d=>setWechatBound(d.bound)); }, []);

  const valid = episodes.length >= 5 && episodes.every(e => e.score >= 90);

  async function step1() {
    setLoading(true);
    try {
      const r = await f('/submissions/step1-pack-elements', 'POST', { projectId, title, dramaType, styleType, episodes });
      if (r.code) { message.error(r.message); return; }
      setSubId(r.id); setElements(r.elements); setStep(1);
    } finally { setLoading(false); }
  }
  async function step2() {
    setLoading(true);
    try {
      const r = await f(`/submissions/${subId}/step2-machine-review`, 'POST');
      setMrScore(r.score); setMrReport(r.report); setStep(2);
    } finally { setLoading(false); }
  }
  async function step3() {
    setLoading(true);
    try {
      await f(`/submissions/${subId}/step3-submit`, 'POST');
      message.success('送审成功！请等待运营审核。');
      setOpen(false); onDone();
    } catch(e:any) { message.error(e.message); }
    finally { setLoading(false); }
  }

  return <>
    {valid && <Button icon={<SendOutlined />} onClick={()=>setOpen(true)}>送审</Button>}
    <Modal title="送审流程" open={open} onCancel={()=>{setOpen(false);setStep(0);}} footer={null} width={640}>
      {!wechatBound && <Alert type="warning" message="送审前需绑定微信" style={{marginBottom:16}} description={<WechatForm onSubmit={async (v:any)=>{await f('/submissions/bind-wechat','POST',v);setWechatBound(true);}} />} />}
      <Steps current={step} items={[{title:'打包三要素'},{title:'机器审核'},{title:'确认送审'}]} style={{marginBottom:24}} />
      {step===0 && <>
        <Card title="送审说明" size="small" style={{marginBottom:12}}>
          <ul style={{paddingLeft:20,margin:0}}>
            <li>确认作品包含 ≥5 集内容，且每集自检分数 ≥90</li>
            <li>系统将自动打包三要素（标题、类型、内容概要）</li>
            <li>机器审核将使用审核模型自动评估作品质量</li>
            <li>机器审核通过后（≥90分），可提交送审</li>
          </ul>
        </Card>
        <Descriptions column={2} size="small" style={{marginBottom:12}}>
          <Descriptions.Item label="标题">{title}</Descriptions.Item>
          <Descriptions.Item label="类型">{dramaType}</Descriptions.Item>
          <Descriptions.Item label="集数">{episodes.length}集</Descriptions.Item>
          <Descriptions.Item label="达标集">{episodes.filter(e=>e.score>=90).length}/{episodes.length}</Descriptions.Item>
        </Descriptions>
        {episodes.slice(0,5).map(e=><Tag key={e.number} color={e.score>=90?'success':'error'}>{e.number}.{e.title} {e.score}分</Tag>)}
        <Button type="primary" block onClick={step1} loading={loading} disabled={!wechatBound} style={{marginTop:16}}>Step 1: 打包三要素</Button>
      </>}
      {step===1 && <>
        <Card title="三要素" size="small" style={{background:'#fafafa',marginBottom:12}}><pre style={{whiteSpace:'pre-wrap',margin:0,fontSize:13,maxHeight:200,overflow:'auto'}}>{JSON.stringify(elements,null,2)}</pre></Card>
        <Button type="primary" block icon={<AuditOutlined />} onClick={step2} loading={loading}>Step 2: 机器审核</Button>
      </>}
      {step===2 && <>
        <Card title={`机检报告 - ${mrScore}分`} size="small" style={{background:mrScore>=90?'#f6ffed':'#fff2f0',marginBottom:12}}>
          <pre style={{whiteSpace:'pre-wrap',margin:0,fontSize:13}}>{mrReport}</pre>
        </Card>
        {mrScore>=90 ? <Button type="primary" block icon={<SendOutlined />} onClick={step3} loading={loading}>Step 3: 确认送审</Button> : <Alert type="error" message="机检未达标，无法送审" description="机检分数低于90分，建议优化后重新提交。" />}
      </>}
    </Modal>
  </>;
}
