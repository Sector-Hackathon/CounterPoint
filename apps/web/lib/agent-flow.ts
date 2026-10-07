import type { StepEvent } from './api';
import type { SessionState } from './session-state';
import { isVisibleStep } from './session-logic';

export type NodeStatus = 'waiting' | 'running' | 'done' | 'warning' | 'failed' | 'skipped' | 'interrupted';
export interface AgentNode {
  id: string;
  title: string;
  status: NodeStatus;
  description: string;
  claimId?: string;
  step?: StepEvent;
}

export const NODE_STATUS_LABEL: Record<NodeStatus, string> = {
  waiting: 'Menunggu', running: 'Sedang berjalan', done: 'Selesai', warning: 'Ada keterbatasan',
  failed: 'Gagal', skipped: 'Tidak dijalankan', interrupted: 'Terhenti',
};

export function stepNodeStatus(step: StepEvent, terminal: boolean): NodeStatus {
  if (step.resultStatus === 'RUNNING') return terminal ? 'interrupted' : 'running';
  if (step.resultStatus === 'ERROR') return 'failed';
  if (step.resultStatus === 'NO_DATA' || ['TIMEOUT', 'BUDGET_EXHAUSTED', 'UNOBTAINABLE'].includes(step.stopReason ?? '')) return 'warning';
  if (step.stopReason === 'OUT_OF_SCOPE') return 'skipped';
  if (step.stopReason === 'ERROR') return 'failed';
  return 'done';
}

/** Observed steps only. Future checks and parallel execution are never invented. */
export function buildAgentFlow(state: SessionState) {
  const terminal = ['COMPLETED', 'PARTIAL', 'FAILED'].includes(state.status);
  const extracted = state.claims.length > 0;
  const preparation: AgentNode = {
    id: 'preparation', title: 'Identifikasi saham dan klaim',
    status: extracted ? 'done' : state.status === 'AWAITING_CONFIRMATION' ? 'warning' : terminal ? 'failed' : 'running',
    description: extracted ? 'Pesan telah dipecah menjadi klaim.' : state.status === 'AWAITING_CONFIRMATION' ? 'Menunggu konfirmasi perusahaan.' : state.error ?? 'Mengenali perusahaan dan klaim dari pesan.',
  };
  const lanes = state.claims.map((claim) => {
    const visible = claim.steps.filter(isVisibleStep);
    const nodes: AgentNode[] = visible.map((step) => ({
      id: `${claim.id}:${step.sequence}`, title: step.question ?? step.action,
      status: stepNodeStatus(step, terminal), description: step.reason, claimId: claim.id, step,
    }));
    if (!nodes.length) nodes.push({
      id: `waiting:${claim.id}`, title: 'Pemeriksaan klaim', claimId: claim.id,
      status: terminal ? 'skipped' : 'waiting', description: terminal ? 'Tidak ada langkah pemeriksaan yang tercatat.' : 'Menunggu giliran pemeriksaan.',
    });
    return { claim, nodes };
  });
  const allAssessed = extracted && state.claims.every((c) => c.assessment !== null);
  const report: AgentNode = {
    id: 'report', title: 'Susun dan validasi laporan',
    status: state.reportId ? 'done' : state.status === 'FAILED' ? 'failed' : terminal ? 'skipped' : allAssessed ? 'running' : 'waiting',
    description: state.reportId ? 'Laporan bukti telah tersedia.' : allAssessed && !terminal ? 'Menyusun hasil dan memvalidasi pernyataan terhadap bukti.' : 'Laporan disusun setelah pemeriksaan klaim.',
  };
  return { preparation, lanes, report, nodes: [preparation, ...lanes.flatMap((lane) => lane.nodes), report] };
}
