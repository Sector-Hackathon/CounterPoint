import { AuthBoundary } from '@/components/AuthProvider';
export default function Layout({ children }: { children: React.ReactNode }) { return <AuthBoundary>{children}</AuthBoundary>; }
