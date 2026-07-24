'use client';

import '@ant-design/v5-patch-for-react-19';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { session } from '../../lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!session.hasToken()) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [router, pathname]);

  // SSR 时不执行客户端检查，避免 hydration mismatch
  if (!mounted) return <>{children}</>;
  if (!session.hasToken()) return null;

  return <>{children}</>;
}
