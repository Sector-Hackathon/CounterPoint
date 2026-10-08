'use client';
/*
 * Landing page direction contract. Built from the two approved mockups (light and dark).
 *
 * THESIS: one message, split and tested. The hero shows the product's real mechanism, a pasted
 *   stock pitch branching into its claims with a verdict on each, instead of a generic screenshot.
 * OWN-WORLD: a lavender field with white ribbons (light) or an ink-navy field with violet light
 *   streaks (dark); frosted glass plates with hairline edges and indigo-tinted depth; an
 *   indigo-to-violet brand gradient. Verdicts keep the product palette (indigo / amber / hatch),
 *   never green and red, so nothing reads as a buy or sell signal.
 * STORY: a convincing pitch is several claims; each is judged on evidence; check yours.
 * FIRST VIEWPORT: headline left with a gradient last line and the primary action beneath it;
 *   the quote and its three claim cards on glowing connectors to the right; a tilted app window
 *   rising from below that settles flat as the page scrolls.
 * FORM: user-pinned comp, no concept roll. Display face: Plus Jakarta Sans, the closest face to
 *   the mockup's lettering.
 *
 * Every figure here is illustrative and labelled as such. Claim types, verdicts and data sources
 * match what the product actually does: it checks Sectors company data, not news or third-party
 * analysis, and a price prediction is unverifiable rather than unsupported.
 */
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowDown, ArrowRight, CalendarDays, ChartColumn, Check, ChevronDown, CircleHelp, ClipboardCheck, Database,
  FileText, History, House, Link2, MessageSquare, Minus, Quote, Search, Target, TrendingUp, Users,
} from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import './landing.css';

type Verdict = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'UNVERIFIABLE';

const MESSAGE = 'XYZ menarik! Labanya naik 20% tahun ini, valuasinya paling murah. Harga pasti tembus 6.000!';

const CLAIMS: { Icon: typeof FileText; topic: string; method: string; quote: string; verdict: Verdict; label: string; metric: string; value: string; reason: string; caveat: string }[] = [
  {
    Icon: FileText, topic: 'Pertumbuhan laba', method: 'Dicek ke laporan keuangan', quote: 'Labanya naik 20% tahun ini.',
    verdict: 'SUPPORTED', label: 'Didukung', metric: 'Pertumbuhan laba', value: '+20%',
    reason: 'Pada contoh ini, laba berubah dari 100 menjadi 120 pada periode pembanding yang sama.',
    caveat: 'Kenaikan laba sendiri belum membuktikan harga akan naik.',
  },
  {
    Icon: Users, topic: 'Valuasi vs peer', method: 'Dibandingkan dengan median peer', quote: 'Valuasinya paling murah.',
    verdict: 'PARTIALLY_SUPPORTED', label: 'Sebagian', metric: 'PER vs pembanding', value: '8× / 10×',
    reason: 'PER contoh lebih rendah dari median pembanding, tetapi itu belum membuktikan bahwa saham ini paling murah.',
    caveat: 'Perusahaan pembanding dan periode data perlu diperhatikan.',
  },
  {
    Icon: Target, topic: 'Target harga', method: 'Masa depan tidak ada di data', quote: 'Harga pasti tembus 6.000.',
    verdict: 'UNVERIFIABLE', label: 'Belum terverifikasi', metric: 'Target harga', value: '6.000?',
    reason: 'Data historis pada contoh ini tidak dapat memastikan harga saham di masa depan.',
    caveat: 'Prediksi harga bukan kepastian, meskipun sebagian alasan fundamentalnya didukung.',
  },
];

const VERDICT_ICON = { SUPPORTED: Check, PARTIALLY_SUPPORTED: Minus, UNVERIFIABLE: CircleHelp } as const;

/** Card centres in the 600-unit connector frame, matching the three-column card grid below it. */
const CONNECTORS = ['M300 0 C300 52 96 38 96 90', 'M300 0 L300 90', 'M300 0 C300 52 504 38 504 90'];
const CARD_X = [96, 300, 504];

function VerdictChip({ verdict, label }: { verdict: Verdict; label: string }) {
  const { t } = useLanguage();
  const Icon = VERDICT_ICON[verdict];
  return <span className="lp-verdict" data-v={verdict}><Icon size={14} strokeWidth={2.6} aria-hidden="true" />{t(label)}</span>;
}

/**
 * The light that runs behind the whole page: white ribbons in light mode, violet streaks in dark
 * mode. One drawing covers every section, so the lines cross the boundaries instead of ending at
 * them. Coordinates are pixels at a 1600px-wide desktop (hero 0-1130, section 2 to 2140, section 3
 * to 3270, FAQ to 3790, closing card to the end); the drawing stretches to the real height, and
 * strokes keep their width while it does.
 */
const FLOW_DIAGONAL = 'M-256 924 C 152 828 464 672 788 564 S 1364 348 1868 132';
const FLOW_FLOURISH = 'M1364 270 C 1520 348 1664 288 1808 48';
// The thread: arcs behind the app window, then runs down the right margin to the foot of the page.
const FLOW_THREAD = 'M-232 1080 C 344 768 1016 700 1360 800 C 1560 860 1620 1000 1560 1160 C 1500 1320 1440 1420 1500 1580 C 1560 1740 1580 1920 1530 2100 C 1480 2280 1470 2440 1510 2620 C 1550 2800 1570 2980 1530 3160 C 1490 3340 1480 3520 1520 3700 C 1560 3880 1580 4060 1640 4200 C 1680 4290 1740 4340 1800 4380';
// Its partner on the left: from under the app window down the left margin, past every card.
const FLOW_LEFT = 'M380 1020 C 170 1080 50 1190 70 1340 C 90 1480 60 1620 40 1760 C 25 1880 70 2000 90 2160 C 110 2320 60 2480 70 2660 C 80 2840 110 3000 90 3180 C 70 3360 60 3540 80 3720 C 100 3900 60 4100 -40 4240 C -90 4310 -140 4350 -200 4380';
// Section 3's accents in the right margin, beside the report card.
const FLOW_SWEEP = 'M1720 2177 C 1400 2227 1250 2437 1330 2677 S 1600 3037 1720 3097';
const FLOW_ARC = 'M1720 2387 C 1530 2427 1440 2557 1480 2717 S 1640 2937 1720 2957';
const FLOW_RIBBON = 'M-256 768 C 128 732 416 624 680 528 S 1160 360 1592 300';
const FLOW_FLOOR = 'M-100 2120 C 500 1990 1100 2000 1760 2100';

function FlowBackdrop() {
  return <div className="lp-flow-backdrop" aria-hidden="true">
    <svg className="lp-ribbons" viewBox="0 0 1600 4330" preserveAspectRatio="none">
      <path d={FLOW_DIAGONAL} /><path className="is-wide" d={FLOW_RIBBON} /><path d={FLOW_THREAD} /><path d={FLOW_LEFT} /><path className="is-wide" d={FLOW_FLOOR} /><path className="is-wide" d={FLOW_SWEEP} />
    </svg>
    <svg className="lp-streaks" viewBox="0 0 1600 4330" preserveAspectRatio="none">
      <path d={FLOW_DIAGONAL} /><path d={FLOW_FLOURISH} /><path d={FLOW_THREAD} /><path d={FLOW_LEFT} /><path d={FLOW_ARC} />
    </svg>
  </div>;
}

/** Step 1: one message branches into the claims inside it. */
function SplitArt() {
  const { t } = useLanguage();
  return <div className="lp-art lp-art-split">
    <span className="lp-art-ghost is-a"><FileText size={26} /></span>
    <span className="lp-art-ghost is-b"><ChartColumn size={26} /></span>
    <div className="lp-art-quote"><Quote size={22} /><p>“{t('XYZ menarik! Laba naik 20%, valuasi paling murah, harga pasti naik.')}”</p></div>
    <svg className="lp-art-lines" viewBox="0 0 400 64">
      <path d="M200 0 C200 34 63 26 63 60" /><path d="M200 0 L200 60" /><path d="M200 0 C200 34 337 26 337 60" />
      <circle cx="200" cy="3" r="4.5" /><circle cx="63" cy="60" r="4.5" /><circle cx="200" cy="60" r="4.5" /><circle cx="337" cy="60" r="4.5" />
    </svg>
    <div className="lp-art-chips">
      <span><ChartColumn size={19} />{t('Laba naik 20%')}</span>
      <span><Database size={19} />{t('Valuasi paling murah')}</span>
      <span><TrendingUp size={19} />{t('Harga pasti naik')}</span>
    </div>
  </div>;
}

/** Step 2: the same claim, tested for support and for what could weaken it. */
function TestArt() {
  const { t } = useLanguage();
  return <div className="lp-art lp-art-test">
    <span className="lp-art-ghost is-a"><ChartColumn size={26} /></span>
    <span className="lp-art-ghost is-b"><FileText size={26} /></span>
    <div className="lp-art-pill"><Database size={20} />{t('Valuasi paling murah')}</div>
    <svg className="lp-art-lines is-two" viewBox="0 0 400 64">
      <path d="M200 0 C200 36 93 24 93 60" /><path d="M200 0 C200 36 307 24 307 60" />
      <circle cx="200" cy="3" r="4.5" /><circle cx="93" cy="60" r="4.5" /><circle cx="307" cy="60" r="4.5" />
    </svg>
    <div className="lp-art-sides">
      <div data-side="for"><strong><FileText size={17} />{t('Mendukung')}</strong><span>{t('P/E di bawah median peer')}</span></div>
      <div data-side="against"><strong><FileText size={17} />{t('Menantang')}</strong><span>{t('ROE di bawah median peer')}</span></div>
    </div>
  </div>;
}

/** Step 3: what an assessment rests on, layered like the report's evidence. */
function TraceArt() {
  const { t } = useLanguage();
  const panels = [
    { Icon: ClipboardCheck, label: 'Kesimpulan', value: 'Didukung sebagian', tone: 'verdict' },
    { Icon: CalendarDays, label: 'Data & periode', value: 'FY2024', tone: undefined },
    { Icon: Link2, label: 'Sumber', value: 'Data Sectors', tone: undefined },
  ];
  return <div className="lp-art lp-art-trace">
    <div className="lp-art-stack">
      {panels.map(({ Icon, label, value, tone }) => <div key={label} className="lp-art-panel" data-tone={tone}>
        <span className="lp-art-panel-icon"><Icon size={21} /></span>
        <span><span className="lp-art-panel-label">{t(label)}</span><span className="lp-art-panel-value">{value === 'FY2024' ? value : t(value)}</span></span>
        <ChevronDown size={18} />
      </div>)}
    </div>
  </div>;
}

const STEPS = [
  { Art: SplitArt, title: 'Pisahkan klaimnya.', body: 'Setiap alasan dalam satu pesan diperiksa secara terpisah.' },
  { Art: TestArt, title: 'Uji dua sisinya.', body: 'Cari apa yang mendukung klaim, sekaligus apa yang dapat melemahkannya.' },
  { Art: TraceArt, title: 'Buka dasar penilaiannya.', body: 'Lihat sumber, periode, dan batas pemeriksaannya.' },
];

/**
 * Section 3: one claim's report, laid out like the product's claim view (ClaimAnalytics): the
 * result with its evidence tally, key numbers, the counter-case as yes/no questions, and the
 * agent's steps. It is the hero's second claim, so the example reads as one story. The checks,
 * thresholds and outcomes follow the relative-valuation contract; the figures are illustrative.
 */
type Outcome = 'supports' | 'weakens' | 'neutral';
const OUTCOME_LABEL: Record<Outcome, string> = { supports: 'Mendukung', weakens: 'Melemahkan', neutral: 'Netral' };

const REPORT_METRICS: { label: string; value: string; outcome: Outcome; period: string; limit?: string; rule?: string; faded?: boolean }[] = [
  { label: 'P/E vs median pembanding', value: '−20.0%', outcome: 'supports', period: 'FY2025', limit: '−10.0%', rule: 'Mendukung jika P/E minimal 10% di bawah median perusahaan pembanding.' },
  { label: 'ROE vs median pembanding', value: '−4.3 pp', outcome: 'weakens', period: 'FY2025', limit: '−3.0 pp', rule: 'Melemahkan jika ROE minimal 3 pp di bawah median perusahaan pembanding.' },
  { label: 'P/BV vs median pembanding', value: '−21.4%', outcome: 'neutral', period: 'FY2025' },
  { label: 'Pembanding yang valid', value: '8', outcome: 'neutral', period: 'FY2025', faded: true },
];

const REPORT_COUNTER: { question: string; answer: 'yes' | 'no'; note?: string }[] = [
  { question: 'Apakah valuasinya lebih murah karena ROE lebih rendah dari perusahaan pembanding?', answer: 'yes', note: 'ROE −4.3 pp' },
  { question: 'Apakah P/E ini normal bagi perusahaan ini sehingga tidak murah dibanding riwayatnya sendiri?', answer: 'no' },
  { question: 'Apakah valuasi rendah terjadi bersamaan dengan penurunan besar harga saham?', answer: 'no' },
];

const REPORT_STEPS: { label: string; outcome: Outcome; counter?: boolean }[] = [
  { label: 'Ambil P/E perusahaan', outcome: 'neutral' },
  { label: 'Tetapkan perusahaan pembanding', outcome: 'neutral' },
  { label: 'Bandingkan P/E dengan median pembanding', outcome: 'supports' },
  { label: 'Cek silang P/BV dengan median pembanding', outcome: 'neutral' },
  { label: 'Uji ROE dibanding perusahaan pembanding', outcome: 'weakens', counter: true },
  { label: 'Uji P/E dibanding riwayatnya sendiri', outcome: 'neutral', counter: true },
  { label: 'Uji penurunan harga dari puncak 52 minggu', outcome: 'neutral', counter: true },
];

function ReportPreview() {
  const { t } = useLanguage();
  const [showSteps, setShowSteps] = useState(false);
  const tally = { supports: 0, weakens: 0, neutral: 0 };
  for (const step of REPORT_STEPS) tally[step.outcome] += 1;
  return <div className="lp-report">
    <span className="lp-report-source"><Database size={15} aria-hidden="true" />{t('Contoh laporan, angka ilustrasi')}</span>
    <div className="lp-report-tab"><span className="lp-report-n">2</span><span className="lp-report-tab-text">{t('Valuasinya paling murah.')}</span><VerdictChip verdict="PARTIALLY_SUPPORTED" label="Didukung sebagian" /><ChevronDown size={18} aria-hidden="true" /></div>
    <article className="lp-report-body" aria-label={t('Contoh laporan klaim')}>
      <header className="lp-report-head"><h3>“{t('Valuasinya paling murah.')}”</h3><VerdictChip verdict="PARTIALLY_SUPPORTED" label="Didukung sebagian" /></header>
      <div className="lp-report-grid">
        <div className="lp-report-panel lp-report-result">
          <span className="lp-report-label">{t('Hasil')}</span>
          <strong>{t('Didukung sebagian')}</strong>
          <ul aria-label={t('Ringkasan bukti')}>
            {(Object.keys(tally) as Outcome[]).map((o) => <li key={o} data-o={o}><b>{tally[o]}</b>{t(OUTCOME_LABEL[o].toLowerCase())}</li>)}
          </ul>
          <div className="lp-report-coverage">
            <span className="lp-report-meter" aria-hidden="true"><span /><span /><span /></span>
            <span>{t('{completed} dari {required} pemeriksaan wajib tersedia', { completed: 3, required: 3 })}</span>
          </div>
        </div>
        <div className="lp-report-panel lp-report-metrics">
          <span className="lp-report-label">{t('Angka utama')}</span>
          {REPORT_METRICS.map((m) => <div key={m.label} className="lp-report-metric" data-faded={m.faded || undefined}>
            <span className="lp-report-mlabel">{t(m.label)}</span>
            <span className="lp-report-pill" data-o={m.outcome}>{t(OUTCOME_LABEL[m.outcome])}</span>
            <span className="lp-report-mvalue">{m.value}</span>
            <span className="lp-report-mmeta">{m.period}{m.limit && <> · {t('batas')} {m.limit}</>}{m.rule && <span title={t(m.rule)}><CircleHelp size={12} aria-label={t(m.rule)} /></span>}</span>
          </div>)}
        </div>
        <div className="lp-report-panel lp-report-counter">
          <span className="lp-report-label">{t('Alasan tandingan')}</span>
          <ul>
            {REPORT_COUNTER.map((c) => <li key={c.question}>
              <span>{t(c.question)}</span>
              <span className="lp-report-answer" data-a={c.answer}>{t(c.answer === 'yes' ? 'Ya' : 'Tidak')}</span>
              {c.note && <small>{c.note}</small>}
            </li>)}
          </ul>
        </div>
      </div>
      <div className="lp-report-timeline">
        <span className="lp-report-label">Agent</span>
        <ol className="lp-report-dots" aria-hidden="true">
          {REPORT_STEPS.map((step) => <li key={step.label} data-o={step.outcome} data-counter={step.counter || undefined} />)}
        </ol>
        <span className="lp-report-count">{t('{count} langkah', { count: REPORT_STEPS.length })}</span>
        <button type="button" className="lp-report-link" aria-expanded={showSteps} onClick={() => setShowSteps((v) => !v)}>
          {t(showSteps ? 'Sembunyikan langkah' : 'Lihat langkah')}<ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
      {showSteps && <ol className="lp-report-steps">
        {REPORT_STEPS.map((step) => <li key={step.label} data-o={step.outcome}><span>{t(step.label)}</span><span className="lp-report-pill" data-o={step.outcome}>{t(OUTCOME_LABEL[step.outcome])}</span></li>)}
      </ol>}
      <details className="lp-report-detail">
        <summary>{t('Detail lengkap & sumber')}</summary>
        <p>{t('Di laporan asli, setiap angka bisa dibuka untuk melihat sumber data Sectors, periodenya, dan daftar perusahaan pembanding yang dipakai.')}</p>
      </details>
    </article>
  </div>;
}

function ResultsSection() {
  const { t } = useLanguage();
  return <section id="reading-results" className="lp-results" aria-labelledby="results-title">
    <div className="lp-container">
      <div className="lp-section-head">
        <span className="lp-eyebrow">{t('Cara membaca hasil')}</span>
        <h2 id="results-title">{t('Labelnya singkat.')} <br /><span className="lp-accent">{t('Dasarnya bisa dibuka.')}</span></h2>
        <p className="lp-section-lead">{t('Lihat angka utama, alasan tandingan, dan jejak pemeriksaannya dalam satu laporan.')}</p>
      </div>
      <ReportPreview />
    </div>
  </section>;
}

const FAQ = [
  ['Apakah Counterpoint memberi rekomendasi beli atau jual?', 'Tidak. Counterpoint memeriksa dukungan bukti terhadap klaim. Hasilnya bukan rekomendasi transaksi dan tidak menjamin harga akan naik atau turun.'],
  ['Data apa yang dipakai?', 'Data perusahaan dari Sectors, seperti laporan keuangan, valuasi, dan perbandingan dengan perusahaan sejenis. Counterpoint tidak membaca berita atau opini analis, jadi klaim yang bergantung pada keduanya bisa tetap belum terverifikasi.'],
  ['Apakah semua klaim bisa diverifikasi?', 'Tidak selalu. Prediksi harga atau klaim di luar cakupan data bisa tetap belum terverifikasi. Keterbatasan tersebut ditampilkan pada hasil pemeriksaan.'],
  ['Bisa langsung pakai screenshot?', 'Bisa. Unggah PNG, JPEG, atau WebP hingga 4 MB. Teks hasil pembacaan bisa kamu edit sebelum diperiksa.'],
  ['Apakah hasilnya bisa dibuka lagi?', 'Bisa lewat tab Riwayat setelah masuk. Pemeriksaan tersimpan di akunmu dan bisa dibuka dari perangkat lain. Tautan laporan hanya dapat dibuka oleh akun pemiliknya.'],
];

const LOGO_SRC = '/brand/counterpoint-logo-concept.png';

/** The closing card's drawing: a report, its numbers, and the line that runs through them. */
function ClosingArt() {
  const { t } = useLanguage();
  return <div className="lp-closing-art" aria-hidden="true">
    <svg className="lp-closing-line" viewBox="0 0 760 400" preserveAspectRatio="none">
      <path d="M-460 440 C -120 340 140 256 300 244 C 420 236 470 300 520 262 C 556 232 548 122 578 96 C 620 60 700 70 800 124" />
    </svg>
    <span className="lp-closing-dot" />
    <div className="lp-closing-doc">
      <span className="lp-closing-mark"><Image src={LOGO_SRC} alt="" width={2172} height={724} /></span>
      <i /><i /><i className="is-short" /><i /><i className="is-short" />
    </div>
    <div className="lp-closing-chart"><b /><b /><b /><b /><b /></div>
    <div className="lp-closing-pill"><ChartColumn size={22} />{t('Cek data, bukan sekadar ajakan.')}</div>
    <div className="lp-closing-pie"><span /><i /><i /><i className="is-short" /></div>
  </div>;
}

/** The close: one last call to check a pitch, with the brand and the disclaimer in the same card. */
function ClosingSection() {
  const { t } = useLanguage();
  return <section className="lp-container lp-closing-wrap" aria-labelledby="closing-title">
    <div className="lp-closing">
      <ClosingArt />
      <div className="lp-closing-copy">
        <span className="lp-kicker lp-kicker-caps">{t('Siap cek sendiri?')}</span>
        <h2 id="closing-title">{t('Ada ajakan saham')} <br /><span className="lp-accent">{t('yang ingin kamu cek?')}</span></h2>
        <p>{t('Bawa pesannya. Lihat apa yang didukung data sebelum menarik kesimpulan.')}</p>
        <Link className="lp-cta" href="/check">{t('Cek klaim sekarang')}<ArrowRight size={18} aria-hidden="true" /></Link>
      </div>
      <footer className="lp-closing-foot">
        <span className="lp-closing-brand"><Image src={LOGO_SRC} alt="Counterpoint" width={2172} height={724} /></span>
        <p>{t('Informasi dan analisis saja, bukan rekomendasi beli, jual, atau tahan saham.')}</p>
      </footer>
    </div>
  </section>;
}

/** Section 2: how one message becomes evidence you can trace. */
function ProcessSection() {
  const { t } = useLanguage();
  return <section id="how-it-works" className="lp-process" aria-labelledby="how-title">
    <div className="lp-container">
      <div className="lp-process-head">
        <div>
          <span className="lp-kicker lp-kicker-caps">{t('Cara kerja Counterpoint')}</span>
          <h2 id="how-title">{t('Dari satu pesan,')} <br /><span className="lp-accent">{t('sampai bukti yang bisa ditelusuri.')}</span></h2>
        </div>
        <p className="lp-process-lead">{t('Counterpoint memecah sebuah ajakan menjadi klaim yang bisa diuji, memeriksa bukti dari dua sisi, lalu menunjukkan dasar penilaiannya.')}</p>
      </div>
      <ol className="lp-process-steps">
        {STEPS.map(({ Art, title, body }, i) => <li key={title} className="lp-glass lp-process-card">
          <div className="lp-process-art" aria-hidden="true"><Art /></div>
          <div className="lp-process-text">
            <span className="lp-step-badge" aria-hidden="true">0{i + 1}</span>
            <div><h3>{t(title)}</h3><p>{t(body)}</p></div>
          </div>
        </li>)}
      </ol>
    </div>
  </section>;
}

export function LandingPage() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(0);
  const claim = CLAIMS[selected]!;

  return <main id="main-content" className="lp">
    <div className="lp-flow">
      <FlowBackdrop />
      <section className="lp-hero" aria-labelledby="landing-title">
        <div className="lp-container lp-hero-grid">
          <div className="lp-hero-copy">
            <span className="lp-kicker"><span aria-hidden="true" />{t('Bukti sebelum keputusan')}</span>
            <h1 id="landing-title">{t('Sebelum percaya')} <br />{t('narasinya,')} <br /><span className="lp-accent">{t('periksa buktinya.')}</span></h1>
            <p className="lp-lead">{t('Counterpoint membantu kamu melihat apakah klaim didukung data, apa yang melemahkannya, dan apa yang belum terbukti.')}</p>
            <div className="lp-actions">
              <Link className="lp-cta" href="/check">{t('Cek klaim sekarang')}<ArrowRight size={18} aria-hidden="true" /></Link>
              <a className="lp-link" href="#how-it-works">{t('Lihat cara kerjanya')}<ArrowDown size={16} aria-hidden="true" /></a>
            </div>
          </div>

          <figure className="lp-branch">
            <figcaption className="visually-hidden">{t('Contoh ilustrasi: satu pesan dipecah menjadi tiga klaim, dan setiap klaim dinilai dengan bukti.')}</figcaption>
            <span className="lp-float lp-float-chart" aria-hidden="true"><ChartColumn size={30} strokeWidth={2.4} /></span>
            <span className="lp-float lp-float-doc" aria-hidden="true"><FileText size={30} strokeWidth={2.2} /></span>
            <blockquote className="lp-glass lp-quote">
              <Quote className="lp-quote-mark" size={30} aria-hidden="true" />
              <p>“{t(MESSAGE)}”</p>
            </blockquote>
            <svg className="lp-connectors" viewBox="0 0 600 90" aria-hidden="true">
              {CONNECTORS.map((d, i) => <path key={d} d={d} pathLength={1} data-active={selected === i || undefined} />)}
              <circle cx="300" cy="3" r="5" />
              {CARD_X.map((x, i) => <circle key={x} cx={x} cy="87" r="4.5" data-active={selected === i || undefined} />)}
            </svg>
            <ul className="lp-claim-cards">
              {CLAIMS.map((c, i) => <li key={c.topic}>
                <button type="button" className="lp-glass lp-claim-card" aria-pressed={selected === i} onClick={() => setSelected(i)}>
                  <span className="lp-card-head">
                    <span className="lp-card-icon"><c.Icon size={21} aria-hidden="true" /></span>
                    <span><strong>{t(c.topic)}</strong><span>{t(c.method)}</span></span>
                  </span>
                  <VerdictChip verdict={c.verdict} label={c.label} />
                </button>
              </li>)}
            </ul>
          </figure>
        </div>

        <div className="lp-container lp-app-stage">
          <div className="lp-app" role="group" aria-label={t('Contoh tampilan hasil pemeriksaan')}>
            <div className="lp-app-chrome" aria-hidden="true"><span /><span /><span /></div>
            <div className="lp-app-body">
              <div className="lp-app-side" aria-hidden="true">
                <Image className="lp-app-logo" src={LOGO_SRC} alt="" width={2172} height={724} />
                <span className="is-active"><House size={17} />{t('Pemeriksaan')}</span>
                <span><History size={17} />{t('Riwayat')}</span>
              </div>
              <div className="lp-app-main">
                <div className="lp-app-title">
                  <strong>{t('Hasil pemeriksaan')}</strong>
                  <span className="lp-demo-tag">{t('Contoh ilustrasi')}</span>
                </div>
                <p className="lp-app-sub">{t('Ditemukan 3 klaim utama dari pesan kamu.')}</p>
                <div className="lp-app-message">
                  <MessageSquare size={18} aria-hidden="true" />
                  <div><span>{t('Pesan yang kamu periksa')}</span><p>{t(MESSAGE)}</p></div>
                </div>
                <ol className="lp-app-claims" aria-label={t('Pilih contoh klaim')}>
                  {CLAIMS.map((c, i) => <li key={c.quote}>
                    <button type="button" aria-pressed={selected === i} onClick={() => setSelected(i)}>
                      <span className="lp-ordinal">0{i + 1}</span>
                      <span className="lp-app-claim">{t(c.quote)}</span>
                      <VerdictChip verdict={c.verdict} label={c.label} />
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  </li>)}
                </ol>
              </div>
              <div className="lp-app-detail" aria-live="polite" aria-atomic="true">
                <span className="lp-detail-label">{t(claim.metric)}</span>
                <strong className="tabular">{claim.value}</strong>
                <p>{t(claim.reason)}</p>
                <p className="lp-detail-caveat"><Search size={15} aria-hidden="true" />{t(claim.caveat)}</p>
              </div>
            </div>
          </div>
          <p className="lp-caption">{t('XYZ dan semua angka di sini adalah ilustrasi, bukan hasil pemeriksaan perusahaan nyata.')}</p>
        </div>
      </section>

      <ProcessSection />

      <ResultsSection />

    <section id="faq" className="lp-container lp-faq" aria-labelledby="faq-title">
      <div className="lp-section-head">
        <span className="lp-kicker lp-kicker-caps">FAQ</span>
        <h2 id="faq-title">{t('Pertanyaan yang mungkin kamu punya.')}</h2>
      </div>
      <div className="lp-glass lp-faq-list">{FAQ.map(([question, answer]) => <details key={question}>
        <summary>{t(question!)}<span className="lp-faq-toggle" aria-hidden="true" /></summary>
        <p>{t(answer!)}</p>
      </details>)}</div>
    </section>

    <ClosingSection />
    </div>
  </main>;
}
