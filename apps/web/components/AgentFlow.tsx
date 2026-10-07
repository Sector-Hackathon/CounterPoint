'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Circle, CircleAlert, GitBranch, LoaderCircle, Minus, Plus, Search, X } from 'lucide-react';
import { buildAgentFlow, NODE_STATUS_LABEL, type AgentNode, type NodeStatus } from '@/lib/agent-flow';
import type { SessionState } from '@/lib/session-state';
import { formatValue, metricLabel, stepHeadline } from '@/lib/format';
import { useLanguage } from './LanguageProvider';
import { Status } from './Status';
import { stopReasonLabel } from '@/lib/display-copy';
import type { ConnectionStatus } from '@/lib/use-session-events';

const ICONS: Record<NodeStatus, typeof Circle> = {
  waiting: Circle, running: LoaderCircle, done: Check, warning: CircleAlert,
  failed: X, skipped: Minus, interrupted: CircleAlert,
};

export function AgentFlow({ state, connection }: { state: SessionState; connection: ConnectionStatus }) {
  const { language, t } = useLanguage();
  const flow = useMemo(() => buildAgentFlow(state), [state]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const detailRef = useRef<HTMLElement>(null);
  const nodeButtonRef = useRef<HTMLButtonElement | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const selectedClaim = useRef<string | undefined>(undefined);
  const selected = flow.nodes.find((node) => node.id === selectedId);
  const label = (node: AgentNode) => node.step ? node.step.question ? t(node.step.question) : stepHeadline(node.step, language) : t(node.title);
  const select = (node: AgentNode) => {
    selectedClaim.current = node.claimId;
    setSelectedId(node.id);
    requestAnimationFrame(() => detailRef.current?.focus());
  };
  useEffect(() => {
    if (!selectedId || flow.nodes.some((node) => node.id === selectedId)) return;
    const replacement = flow.nodes.find((node) => node.claimId && node.claimId === selectedClaim.current);
    setSelectedId(replacement?.id ?? null);
    requestAnimationFrame(() => replacement ? detailRef.current?.focus() : canvasRef.current?.focus());
  }, [selectedId, flow]);
  const renderNode = (node: AgentNode) => {
    const Icon = ICONS[node.status];
    return <button key={node.id} type="button" className="agent-node" data-status={node.status} aria-pressed={selectedId === node.id} onClick={(event) => { nodeButtonRef.current = event.currentTarget; select(node); }}>
      <span className="agent-node-icon"><Icon size={18} className={node.status === 'running' ? 'spin' : undefined} aria-hidden="true" /></span>
      <span className="agent-node-content"><strong>{label(node)}</strong><span className="node-status">{t(NODE_STATUS_LABEL[node.status])}</span>
        {node.step?.phase && <span className="small muted">{t(node.step.phase === 'required' ? 'Pemeriksaan wajib' : node.step.phase === 'counterpoint' ? 'Alasan tandingan' : 'Bukti yang melemahkan')}</span>}
      </span>
    </button>;
  };

  return <section className="agent-flow" aria-labelledby="agent-flow-title">
    <header className="flow-toolbar">
      <div><h2 id="agent-flow-title"><GitBranch size={19} aria-hidden="true" />{t('Alur agent')}</h2><p className="small muted">{t('Klik node untuk melihat alasan, aturan, dan bukti. Klaim diperiksa bergiliran.')}</p></div>
      <div className="zoom-controls" aria-label={t('Ukuran diagram')}>
        <button className="quiet" disabled={zoom <= .75} aria-label={t('Perkecil diagram')} onClick={() => setZoom((z) => Math.max(.75, z - .25))}><Minus size={16} aria-hidden="true" /></button>
        <button className="quiet" onClick={() => setZoom(1)} aria-label={t('Reset ukuran diagram')}>{Math.round(zoom * 100)}%</button>
        <button className="quiet" disabled={zoom >= 1.5} aria-label={t('Perbesar diagram')} onClick={() => setZoom((z) => Math.min(1.5, z + .25))}><Plus size={16} aria-hidden="true" /></button>
      </div>
    </header>
    <p className="flow-connection small" role="status">{t(connection === 'polling' ? 'Mode polling: diagram mengikuti snapshot terbaru, bukan koneksi langsung.' : connection === 'closed' ? 'Sesi berakhir. Diagram menunjukkan langkah yang tercatat.' : connection === 'connecting' ? 'Menghubungkan ke event pemeriksaan…' : connection === 'reconnecting' ? 'Menghubungkan ulang ke event pemeriksaan…' : connection === 'error' ? 'Koneksi pemeriksaan terhenti. Muat ulang halaman untuk mencoba lagi.' : 'Terhubung langsung ke event pemeriksaan.')}</p>
    <div className="flow-workspace">
      <div className="flow-canvas" ref={canvasRef} tabIndex={0} role="region" aria-label={t('Diagram proses agent, geser untuk melihat semua node')}>
        <div className="flow-canvas-content" style={{ zoom }}>
          <div className="flow-stage"><span className="eyebrow">{t('Persiapan')}</span>{renderNode(flow.preparation)}</div>
          <div className="flow-stage-arrow" aria-hidden="true">↓</div>
          {flow.lanes.map(({ claim, nodes }, index) => <section key={claim.id} className="flow-lane" aria-label={`${t('Klaim')} ${index + 1}`}>
            <header><span className="eyebrow">{t('Klaim')} {index + 1}{claim.ticker ? ` · ${claim.ticker}` : ''}</span><p>“{claim.originalText}”</p><Status value={claim.verifiability === 'NO' ? 'UNVERIFIABLE' : claim.assessment} /></header>
            <ol className="flow-node-chain">{nodes.map((node, nodeIndex) => <li key={node.id}>{nodeIndex > 0 && <ArrowRight className="node-connector" size={26} aria-hidden="true" />}{renderNode(node)}</li>)}</ol>
            <div className="flow-stage-arrow" aria-hidden="true">↓</div>
          </section>)}
          {!flow.lanes.length && <p className="small muted">{t('Node pemeriksaan akan muncul saat klaim ditemukan.')}</p>}
          <div className="flow-stage"><span className="eyebrow">{t('Laporan')}</span>{renderNode(flow.report)}</div>
        </div>
      </div>
      {selected ? <aside className="flow-inspector" ref={detailRef} tabIndex={-1} aria-labelledby="node-detail-title">
        <header><span className="eyebrow">{t('Detail node')}</span><button className="quiet" aria-label={t('Tutup detail node')} onClick={() => { setSelectedId(null); if (nodeButtonRef.current?.isConnected) nodeButtonRef.current.focus(); else canvasRef.current?.focus(); }}><X size={16} aria-hidden="true" /></button></header>
        <h3 id="node-detail-title">{label(selected)}</h3>
        <span className="node-status" data-status={selected.status}>{t(NODE_STATUS_LABEL[selected.status])}</span>
        <h4>{t('Alasan pemeriksaan')}</h4><p>{t(selected.description)}</p>
        {selected.step?.rule && <><h4>{t('Aturan penilaian')}</h4><p>{t(selected.step.rule)}</p></>}
        {selected.step?.effect && <><h4>{t('Hasil pemeriksaan')}</h4><p>{t(selected.step.effect)}</p></>}
        {selected.step?.stopReason && <p className="small muted">{t('Alasan berhenti')}: {stopReasonLabel(selected.step.stopReason, language)}</p>}
        {selected.step?.startedAt && <p className="small muted">{t('Mulai')}: {new Date(selected.step.startedAt).toLocaleTimeString(language === 'id' ? 'id-ID' : 'en-GB')}{selected.step.finishedAt && <> · {t('Durasi')}: {Math.max(0, (Date.parse(selected.step.finishedAt) - Date.parse(selected.step.startedAt)) / 1000).toFixed(1)} s</>}</p>}
        {!!selected.step?.evidence.length && <><h4>{t('Data yang digunakan')}</h4><ul className="flow-evidence">{selected.step.evidence.map((item) => <li key={item.id}><strong>{metricLabel(item.metric, language)}</strong><span className="tabular">{formatValue(item.value, item.unit)}</span><span className="small muted">{[item.economicPeriod, item.comparisonPeriod].filter(Boolean).join(' / ')}</span>{item.note && <span className="small muted">{t(item.note)}</span>}</li>)}</ul></>}
        {!!selected.step?.opened.length && <><h4>{t('Pertanyaan lanjutan')}</h4><ul>{selected.step.opened.map((question) => <li key={question}>{t(question)}</li>)}</ul></>}
        {selected.status === 'running' && <p className="small muted">{t('Hasil belum tersedia. Node diperbarui setelah langkah selesai.')}</p>}
      </aside> : <aside className="flow-inspector flow-inspector-empty"><Search size={25} aria-hidden="true" /><p>{t('Pilih node untuk membaca detail prosesnya.')}</p></aside>}
    </div>
    <ul className="flow-legend" aria-label={t('Legenda status node')}>{(['waiting', 'running', 'done', 'warning', 'failed', 'skipped'] as NodeStatus[]).map((status) => <li key={status} data-status={status}><span aria-hidden="true" />{t(NODE_STATUS_LABEL[status])}</li>)}</ul>
  </section>;
}
