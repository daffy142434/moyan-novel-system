'use client';
import { Card, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { dashboard } from '@/lib/api';

export default function ActivityPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { dashboard.activity(30).then(setData); }, []);

  if (!data) return <Spin style={{ margin: '40px auto', display: 'block' }} />;
  const act = data.activity || [];

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>用户活跃度（近30天）</h2>
      <Card title="每日活跃用户数（匿名）" size="small">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 200 }}>
          {act.map((d: any) => (
            <div key={d.date} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: Math.max(4, (d.count / Math.max(1, ...act.map((x: any) => x.count))) * 180), backgroundColor: '#1677ff', borderRadius: '4px 4px 0 0', minWidth: 8 }} />
              <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>{d.date.slice(5)}</div>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{d.count}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
