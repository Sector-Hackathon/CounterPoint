'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowDown, ArrowRight, Check, FileText, GitBranch, Layers, MessageSquare, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

const DEMO_CLAIMS = [
  { quote: 'Labanya naik 20%.', status: 'SUPPORTED', verdict: 'Didukung data', metric: 'Pertumbuhan laba', value: '+20%', reason: 'Pada contoh ini, laba berubah dari 100 menjadi 120 pada periode pembanding yang sama.', caveat: 'Kenaikan laba sendiri belum membuktikan harga akan naik.' },
  { quote: 'Valuasinya paling murah.', status: 'PARTIALLY_SUPPORTED', verdict: 'Didukung sebagian', metric: 'PER vs pembanding', value: '8× / 10×', reason: 'PER contoh lebih rendah dari median pembanding, tetapi itu belum membuktikan bahwa saham ini paling murah.', caveat: 'Perusahaan pembanding dan periode data perlu diperhatikan.' },
  { quote: 'Harga pasti tembus 6.000.', status: 'UNVERIFIABLE', verdict: 'Belum bisa diverifikasi', metric: 'Target harga', value: '6.000?', reason: 'Data historis pada contoh ini tidak dapat memastikan harga saham di masa depan.', caveat: 'Prediksi harga bukan kepastian, meskipun sebagian alasan fundamentalnya didukung.' },
] as const;

const VALUE_PROPS = [
  { Icon: FileText, title: 'Per klaim', body: 'Pisahkan alasan dalam satu pesan.' },
  { Icon: GitBranch, title: 'Dua sisi', body: 'Uji pendukung sekaligus tandingannya.' },
  { Icon: ShieldCheck, title: 'Bisa ditelusuri', body: 'Baca bukti, periode, dan batasannya.' },
];

export function LandingPage() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(0);
  const demo = DEMO_CLAIMS[selected];
  return <main id="main-content" className="landing">
    <section className="landing-hero landing-container" aria-labelledby="landing-title">
      <div className="hero-copy">
        <span className="landing-kicker"><span aria-hidden="true" />{t('Bukti sebelum keputusan')}</span>
        <h1 id="landing-title">{t('Sebelum ikut FOMO,')}<br /><span>{t('cek dulu klaimnya.')}</span></h1>
        <p className="hero-description">{t('Ajakan saham bisa terdengar meyakinkan. Counterpoint membantu kamu melihat apakah alasannya didukung data, apa yang melemahkannya, dan apa yang belum terbukti.')}</p>
        <div className="landing-actions"><Link className="button primary" href="/check">{t('Cek klaim saham')}<ArrowRight size={19} aria-hidden="true" /></Link><a className="landing-secondary" href="#how-it-works">{t('Lihat cara kerjanya')}<ArrowDown size={16} aria-hidden="true" /></a></div>
        <div className="hero-footnote"><ShieldCheck size={17} aria-hidden="true" /><span>{t('Bukti pendukung dan pelemah. Satu laporan yang bisa ditelusuri.')}</span></div>
      </div>
      <div className="hero-preview">
        <div className="preview-top"><span><span className="preview-dot" aria-hidden="true" />{t('Dari pesan ke pemeriksaan')}</span><span className="demo-tag">{t('Contoh ilustrasi')}</span></div>
        <div className="demo-message"><span className="small muted"><MessageSquare size={15} aria-hidden="true" />{t('Pesan yang kamu terima')}</span><p>“{t('XYZ menarik! Labanya naik 20%, valuasinya paling murah. Harga pasti tembus 6.000!')}”</p></div>
        <div className="demo-divider"><Layers size={15} aria-hidden="true" />{t('Satu pesan. Tiga klaim berbeda.')}</div>
        <div className="demo-claims" role="group" aria-label={t('Pilih contoh klaim')}>
          {DEMO_CLAIMS.map((claim, index) => <button type="button" key={claim.quote} aria-pressed={selected === index} onClick={() => setSelected(index)}><span className="demo-ordinal">0{index + 1}</span><span className="demo-claim-content"><strong>{t(claim.quote)}</strong><span className="status" data-s={claim.status}>{t(claim.verdict)}</span></span><ArrowRight size={16} aria-hidden="true" /></button>)}
        </div>
        <div className="demo-evidence" aria-live="polite" aria-atomic="true"><div><span className="eyebrow">{t(demo.metric)}</span><strong className="tabular">{demo.value}</strong></div><p>{t(demo.reason)}</p><span className="demo-caveat"><Search size={15} aria-hidden="true" />{t(demo.caveat)}</span></div>
        <p className="demo-caption">{t('XYZ dan semua angka di sini adalah ilustrasi, bukan hasil pemeriksaan perusahaan nyata.')}</p>
      </div>
    </section>

    <section className="landing-value-strip landing-container" aria-label={t('Prinsip Counterpoint')}>
      {VALUE_PROPS.map(({ Icon, title, body }) => <div key={title}><Icon size={21} aria-hidden="true" /><div><strong>{t(title)}</strong><span>{t(body)}</span></div></div>)}
    </section>

    <section id="why-counterpoint" className="landing-story landing-container" aria-labelledby="why-title">
      <div><span className="eyebrow">{t('Kenapa kami membangun Counterpoint')}</span><h2 id="why-title">{t('Beri ruang untuk berpikir, sebelum ikut percaya.')}</h2><p className="section-lead">{t('Kami ingin menciptakan jeda antara menerima ajakan saham dan mengambil keputusan. Jeda untuk memeriksa, membandingkan, dan memahami ketidakpastian.')}</p></div>
      <div className="story-sequence"><article><span className="story-number">01</span><div><h3>{t('Pesannya datang dari mana saja.')}</h3><p>{t('Stockbit, X, Telegram, atau grup percakapan. Ada angka, cerita pertumbuhan, dan target harga dalam satu pesan.')}</p></div></article><article><span className="story-number">02</span><div><h3>{t('Alasan yang terdengar kuat belum tentu lengkap.')}</h3><p>{t('Angka bisa memakai periode yang berbeda. Pembanding bisa kurang tepat. Sebagian prediksi belum bisa dibuktikan dengan data yang ada.')}</p></div></article><article className="story-question"><span className="story-number">?</span><div><h3>{t('Jadi, apakah ajakan ini didukung bukti?')}</h3><p>{t('Counterpoint memecah klaimnya, memeriksa data Sectors, lalu menguji alasan yang dapat menyanggahnya. Kamu mendapat hasil beserta dasar dan batasannya.')}</p></div></article></div>
    </section>

    <section id="how-it-works" className="landing-how" aria-labelledby="how-title"><div className="landing-container">
      <div className="landing-section-heading"><span className="eyebrow">{t('Cara kerja')}</span><h2 id="how-title">{t('Pesan masuk. Bukti yang bicara.')}</h2><p className="section-lead">{t('Tiga langkah untuk memahami apa yang sebenarnya didukung oleh data.')}</p></div>
      <ol className="how-cards">
        <li><div className="how-card-top"><MessageSquare size={25} aria-hidden="true" /><span>01</span></div><h3>{t('Masukkan pesan atau screenshot')}</h3><p>{t('Tempel ajakan saham, atau unggah screenshot. Baca dan edit teksnya sebelum memulai pemeriksaan.')}</p><div className="how-mini-message"><span /><span /><span /></div></li>
        <li><div className="how-card-top"><GitBranch size={25} aria-hidden="true" /><span>02</span></div><h3>{t('Ikuti pemeriksaan dari dua sisi')}</h3><p>{t('Lihat klaim yang diuji, data yang diperiksa, dan alasan tandingannya. Buka alur agent untuk menelusuri setiap langkah.')}</p><div className="how-mini-flow" aria-hidden="true"><span><FileText size={18} /></span><ArrowRight size={18} /><span><Search size={18} /></span><ArrowRight size={18} /><span><GitBranch size={18} /></span></div></li>
        <li><div className="how-card-top"><FileText size={25} aria-hidden="true" /><span>03</span></div><h3>{t('Baca hasil beserta batasannya')}</h3><p>{t('Lihat klaim yang didukung, dilemahkan, atau belum dapat diverifikasi. Buka bukti pendukungnya dan simpan akses lewat riwayat.')}</p><div className="how-mini-results"><span className="status" data-s="SUPPORTED">{t('Didukung data')}</span><span className="status" data-s="UNVERIFIABLE">{t('Belum bisa diverifikasi')}</span></div></li>
      </ol>
    </div></section>

    <section className="landing-trust landing-container" aria-labelledby="trust-title">
      <div className="trust-intro"><span className="trust-symbol"><ShieldCheck size={36} aria-hidden="true" /></span><span className="eyebrow">{t('Transparansi sejak awal')}</span><h2 id="trust-title">{t('Jangan berhenti pada label. Lihat dasar penilaiannya.')}</h2><p className="section-lead">{t('Hasil pemeriksaan seharusnya bisa dijelaskan. Counterpoint menampilkan dasar penilaian dan hal yang masih belum diketahui.')}</p><Link className="landing-secondary" href="/check">{t('Coba pemeriksaannya')}<ArrowRight size={16} aria-hidden="true" /></Link></div>
      <div className="trust-list">{[
        ['Sumber dan periode terlihat', 'Buka sumber bukti, periode metrik, dan waktu pengambilan data pada laporan.'],
        ['Penilaian punya aturan', 'Perhitungan dan hasil penilaian mengikuti aturan pemeriksaan. Model bahasa membantu menafsirkan pesan dan menyusun penjelasan.'],
        ['Alasan tandingan ikut diuji', 'Pemeriksaan mencari bukti pendukung sekaligus alasan yang dapat melemahkan klaim.'],
        ['Ketidakpastian tetap terlihat', 'Data yang hilang, batas pemeriksaan, dan penggunaan data sintetis untuk demo diberi keterangan.'],
      ].map(([title, description]) => <article key={title}><span><Check size={17} aria-hidden="true" /></span><div><h3>{t(title)}</h3><p>{t(description)}</p></div></article>)}</div>
    </section>

    <section className="landing-faq landing-container" aria-labelledby="faq-title"><div><span className="eyebrow">{t('Sebelum mencoba')}</span><h2 id="faq-title">{t('Pertanyaan yang mungkin kamu punya.')}</h2></div><div className="faq-list">{[
      ['Apakah Counterpoint memberi rekomendasi beli atau jual?', 'Tidak. Counterpoint memeriksa dukungan bukti terhadap klaim. Hasilnya bukan rekomendasi transaksi dan tidak menjamin harga akan naik atau turun.'],
      ['Apakah semua klaim bisa diverifikasi?', 'Tidak selalu. Prediksi harga atau klaim di luar cakupan data bisa tetap belum terverifikasi. Keterbatasan tersebut ditampilkan pada hasil pemeriksaan.'],
      ['Bisa langsung pakai screenshot?', 'Bisa. Unggah PNG, JPEG, atau WebP hingga 4 MB. Teks hasil pembacaan bisa kamu edit sebelum diperiksa.'],
      ['Apakah hasilnya bisa dibuka lagi?', 'Bisa lewat tab Riwayat setelah masuk. Pemeriksaan tersimpan di akunmu dan bisa dibuka dari perangkat lain. Tautan laporan hanya dapat dibuka oleh akun pemiliknya.'],
    ].map(([question, answer]) => <details key={question}><summary>{t(question)}</summary><p>{t(answer)}</p></details>)}</div></section>

    <section className="landing-container"><div className="landing-final"><span className="eyebrow"><Sparkles size={16} aria-hidden="true" />{t('Mulai dari satu pesan')}</span><h2>{t('Ada ajakan saham yang ingin kamu cek?')}</h2><p>{t('Bawa pesannya. Lihat apa yang didukung data sebelum menarik kesimpulan.')}</p><Link className="button primary" href="/check">{t('Cek klaim saham')}<ArrowRight size={18} aria-hidden="true" /></Link></div></section>
    <footer className="landing-footer landing-container"><span>counterpoint.</span><p>{t('Informasi dan analisis saja, bukan rekomendasi beli, jual, atau tahan saham.')}</p></footer>
  </main>;
}
