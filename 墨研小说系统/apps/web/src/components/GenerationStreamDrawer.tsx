'use client';

import '@ant-design/v5-patch-for-react-19';
import { StopOutlined } from '@ant-design/icons';
import { Alert, Button, Drawer, Empty, Progress, Space, Tabs, Typography } from 'antd';
import type { StudioGenerationRunDto } from '@moyan/contracts';

export function GenerationStreamDrawer({
  open,
  title,
  run,
  onStop,
  onClose,
}: {
  open: boolean;
  title: string;
  run: StudioGenerationRunDto | null;
  onStop: () => void;
  onClose: () => void;
}) {
  const running = run?.status === 'queued' || run?.status === 'streaming';
  return (
    <Drawer
      title={title}
      width={720}
      open={open}
      closable={!running}
      maskClosable={!running}
      onClose={onClose}
      extra={running ? <Button danger icon={<StopOutlined />} onClick={onStop}>终止生成</Button> : null}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {running && <Progress percent={100} status="active" showInfo={false} />}
        {run?.status === 'completed' && <Alert type="success" showIcon message="生成完成" />}
        {run?.status === 'cancelled' && <Alert type="warning" showIcon message="生成已终止" />}
        {run?.status === 'failed' && <Alert type="error" showIcon message="生成失败" description={run.errorMessage} />}
        <Tabs
          items={[
            {
              key: 'reasoning',
              label: '推理过程',
              children: run?.reasoning
                ? <Typography.Paragraph className="stream-output">{run.reasoning}</Typography.Paragraph>
                : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={running ? '等待模型返回推理流…' : '模型未返回独立推理内容'} />,
            },
            {
              key: 'content',
              label: '响应内容',
              children: run?.content
                ? <Typography.Paragraph className="stream-output">{run.content}</Typography.Paragraph>
                : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="等待模型响应…" />,
            },
          ]}
        />
      </Space>
    </Drawer>
  );
}
