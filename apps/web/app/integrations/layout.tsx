import { AuthBoundary } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';
export default function Layout({ children }: { children: React.ReactNode }) { return <AuthBoundary><AppShell>{children}</AppShell></AuthBoundary>; }
