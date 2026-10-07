import { redirect } from 'next/navigation';

/** The report now lives inline on the check itself; keep old links working. */
export default async function ReportRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/t/${id}`);
}
