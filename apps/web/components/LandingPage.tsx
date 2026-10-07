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
  ArrowDown, ArrowRight, ChartColumn, Check, CircleHelp, FileText, GitBranch, History, House,
  MessageSquare, Minus, Quote, Search, ShieldCheck, Target, Users,
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

const VALUE_PROPS = [
  { Icon: FileText, title: 'Per klaim', body: 'Pisahkan alasan dalam satu pesan.' },
  { Icon: GitBranch, title: 'Dua sisi', body: 'Uji pendukung sekaligus tandingannya.' },
  { Icon: ShieldCheck, title: 'Bisa ditelusuri', body: 'Baca bukti, periode, dan batasannya.' },
];

/** Card centres in the 600-unit connector frame, matching the three-column card grid below it. */
const CONNECTORS = ['M300 0 C300 52 96 38 96 90', 'M300 0 L300 90', 'M300 0 C300 52 504 38 504 90'];
const CARD_X = [96, 300, 504];

function VerdictChip({ verdict, label }: { verdict: Verdict; label: string }) {
  const { t } = useLanguage();
  const Icon = VERDICT_ICON[verdict];
  return <span className="lp-verdict" data-v={verdict}><Icon size={14} strokeWidth={2.6} aria-hidden="true" />{t(label)}</span>;
}

/** The field behind the hero: white ribbons in light mode, violet light streaks in dark mode. */
function HeroBackdrop() {
  return <div className="lp-backdrop" aria-hidden="true">
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <g className="lp-ribbons">
        <path d="M-80 770 C 260 690 520 560 790 470 S 1270 290 1690 110" />
        <path d="M-80 640 C 240 610 480 520 700 440 S 1100 300 1460 250" />
        <path d="M1270 225 C 1400 290 1520 240 1640 40" />
        <path d="M-60 900 C 420 640 980 610 1700 700" />
      </g>
      <g className="lp-streaks">
        <path d="M-80 770 C 260 690 520 560 790 470 S 1270 290 1690 110" />
        <path d="M1270 225 C 1400 290 1520 240 1640 40" />
        <path d="M-60 900 C 420 640 980 610 1700 700" />
      </g>
    </svg>
  </div>;
}

export function LandingPage() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(0);
  const claim = CLAIMS[selected]!;

  return <main id="main-content" className="lp">
    <section className="lp-hero" aria-labelledby="landing-title">
      <HeroBackdrop />
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
              <Image className="lp-app-logo" src="/brand/counterpoint-logo-concept.png" alt="" width={2172} height={724} />
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

    <section className="lp-container lp-values" aria-label={t('Prinsip Counterpoint')}>
      {VALUE_PROPS.map(({ Icon, title, body }) => <div key={title}>
        <span className="lp-value-icon"><Icon size={20} aria-hidden="true" /></span>
        <div><strong>{t(title)}</strong><span>{t(body)}</span></div>
      </div>)}
    </section>

    <section id="why-counterpoint" className="lp-container lp-split" aria-labelledby="why-title">
      <div>
        <h2 id="why-title">{t('Beri ruang untuk berpikir, sebelum ikut percaya.')}</h2>
        <p className="lp-section-lead">{t('Kami ingin menciptakan jeda antara menerima ajakan saham dan mengambil keputusan. Jeda untuk memeriksa, membandingkan, dan memahami ketidakpastian.')}</p>
      </div>
      <div className="lp-story">
        <article><span className="lp-story-marker" aria-hidden="true">1</span><div><h3>{t('Pesannya datang dari mana saja.')}</h3><p>{t('Stockbit, X, Telegram, atau grup percakapan. Ada angka, cerita pertumbuhan, dan target harga dalam satu pesan.')}</p></div></article>
        <article><span className="lp-story-marker" aria-hidden="true">2</span><div><h3>{t('Alasan yang terdengar kuat belum tentu lengkap.')}</h3><p>{t('Angka bisa memakai periode yang berbeda. Pembanding bisa kurang tepat. Sebagian prediksi belum bisa dibuktikan dengan data yang ada.')}</p></div></article>
        <article className="lp-glass lp-story-question"><span className="lp-story-marker" aria-hidden="true">?</span><div><h3>{t('Jadi, apakah ajakan ini didukung bukti?')}</h3><p>{t('Counterpoint memecah klaimnya, memeriksa data Sectors, lalu menguji alasan yang dapat menyanggahnya. Kamu mendapat hasil beserta dasar dan batasannya.')}</p></div></article>
      </div>
    </section>

    <section id="how-it-works" className="lp-how" aria-labelledby="how-title">
      <div className="lp-container">
        <div className="lp-section-heading">
          <h2 id="how-title">{t('Pesan masuk. Bukti yang bicara.')}</h2>
          <p className="lp-section-lead">{t('Tiga langkah untuk memahami apa yang sebenarnya didukung oleh data.')}</p>
        </div>
        <ol className="lp-steps">
          <li className="lp-glass">
            <div className="lp-step-top"><span className="lp-step-icon"><MessageSquare size={22} aria-hidden="true" /></span><span className="lp-step-index">1</span></div>
            <h3>{t('Masukkan pesan atau screenshot')}</h3>
            <p>{t('Tempel ajakan saham, atau unggah screenshot. Baca dan edit teksnya sebelum memulai pemeriksaan.')}</p>
            <div className="lp-mini-message" aria-hidden="true"><span /><span /><span /></div>
          </li>
          <li className="lp-glass">
            <div className="lp-step-top"><span className="lp-step-icon"><GitBranch size={22} aria-hidden="true" /></span><span className="lp-step-index">2</span></div>
            <h3>{t('Ikuti pemeriksaan dari dua sisi')}</h3>
            <p>{t('Lihat klaim yang diuji, data yang diperiksa, dan alasan tandingannya. Buka alur agent untuk menelusuri setiap langkah.')}</p>
            <div className="lp-mini-flow" aria-hidden="true"><span><FileText size={18} /></span><ArrowRight size={16} /><span><Search size={18} /></span><ArrowRight size={16} /><span><GitBranch size={18} /></span></div>
          </li>
          <li className="lp-glass">
            <div className="lp-step-top"><span className="lp-step-icon"><FileText size={22} aria-hidden="true" /></span><span className="lp-step-index">3</span></div>
            <h3>{t('Baca hasil beserta batasannya')}</h3>
            <p>{t('Lihat klaim yang didukung, dilemahkan, atau belum dapat diverifikasi. Buka bukti pendukungnya dan simpan akses lewat riwayat.')}</p>
            <div className="lp-mini-results"><VerdictChip verdict="SUPPORTED" label="Didukung data" /><VerdictChip verdict="UNVERIFIABLE" label="Belum bisa diverifikasi" /></div>
          </li>
        </ol>
      </div>
    </section>

    <section className="lp-container lp-split" aria-labelledby="trust-title">
      <div>
        <span className="lp-trust-symbol"><ShieldCheck size={32} aria-hidden="true" /></span>
        <h2 id="trust-title">{t('Jangan berhenti pada label. Lihat dasar penilaiannya.')}</h2>
        <p className="lp-section-lead">{t('Hasil pemeriksaan seharusnya bisa dijelaskan. Counterpoint menampilkan dasar penilaian dan hal yang masih belum diketahui.')}</p>
        <Link className="lp-link" href="/check">{t('Coba pemeriksaannya')}<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      <div className="lp-trust">{[
        ['Sumber dan periode terlihat', 'Buka sumber bukti, periode metrik, dan waktu pengambilan data pada laporan.'],
        ['Penilaian punya aturan', 'Perhitungan dan hasil penilaian mengikuti aturan pemeriksaan. Model bahasa membantu menafsirkan pesan dan menyusun penjelasan.'],
        ['Alasan tandingan ikut diuji', 'Pemeriksaan mencari bukti pendukung sekaligus alasan yang dapat melemahkan klaim.'],
        ['Ketidakpastian tetap terlihat', 'Data yang hilang, batas pemeriksaan, dan penggunaan data sintetis untuk demo diberi keterangan.'],
      ].map(([title, description]) => <article key={title}><span><Check size={16} strokeWidth={2.6} aria-hidden="true" /></span><div><h3>{t(title!)}</h3><p>{t(description!)}</p></div></article>)}</div>
    </section>

    <section id="faq" className="lp-container lp-faq" aria-labelledby="faq-title">
      <h2 id="faq-title">{t('Pertanyaan yang mungkin kamu punya.')}</h2>
      <div className="lp-faq-list">{[
        ['Apakah Counterpoint memberi rekomendasi beli atau jual?', 'Tidak. Counterpoint memeriksa dukungan bukti terhadap klaim. Hasilnya bukan rekomendasi transaksi dan tidak menjamin harga akan naik atau turun.'],
        ['Apakah semua klaim bisa diverifikasi?', 'Tidak selalu. Prediksi harga atau klaim di luar cakupan data bisa tetap belum terverifikasi. Keterbatasan tersebut ditampilkan pada hasil pemeriksaan.'],
        ['Bisa langsung pakai screenshot?', 'Bisa. Unggah PNG, JPEG, atau WebP hingga 4 MB. Teks hasil pembacaan bisa kamu edit sebelum diperiksa.'],
        ['Apakah hasilnya bisa dibuka lagi?', 'Bisa lewat tab Riwayat setelah masuk. Pemeriksaan tersimpan di akunmu dan bisa dibuka dari perangkat lain. Tautan laporan hanya dapat dibuka oleh akun pemiliknya.'],
      ].map(([question, answer]) => <details key={question}><summary>{t(question!)}</summary><p>{t(answer!)}</p></details>)}</div>
    </section>

    <section className="lp-container">
      <div className="lp-final">
        <h2>{t('Ada ajakan saham yang ingin kamu cek?')}</h2>
        <p>{t('Bawa pesannya. Lihat apa yang didukung data sebelum menarik kesimpulan.')}</p>
        <Link className="lp-cta" href="/check">{t('Cek klaim sekarang')}<ArrowRight size={18} aria-hidden="true" /></Link>
      </div>
    </section>
    <footer className="lp-container lp-footer"><span>counterpoint.</span><p>{t('Informasi dan analisis saja, bukan rekomendasi beli, jual, atau tahan saham.')}</p></footer>
  </main>;
}
