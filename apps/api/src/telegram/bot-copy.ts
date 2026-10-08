/** Everything the Telegram bot says, as pure functions. Indonesian only; sent as plain text. */

export interface Button { text: string; data?: string; url?: string }

/** The only things the conversation needs from Telegram; tests use a fake. */
export interface ChatPort {
  send(chatId: string, text: string, buttons?: Button[][]): Promise<void>;
  downloadPhoto(fileId: string): Promise<{ base64: string; mimeType: 'image/jpeg' }>;
}

export interface ScoreLine { text: string; assessment: string | null }

const VERDICT: Record<string, { mark: string; text: string }> = {
  SUPPORTED: { mark: '✓', text: 'Didukung data' },
  PARTIALLY_SUPPORTED: { mark: '◐', text: 'Didukung sebagian' },
  NOT_SUPPORTED: { mark: '✗', text: 'Tidak didukung data' },
  UNVERIFIABLE: { mark: '?', text: 'Belum bisa diverifikasi' },
};

const STATUS: Record<string, string> = { COMPLETED: 'Selesai', PARTIAL: 'Selesai sebagian', FAILED: 'Terhenti' };

export function shorten(text: string, max = 40): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

export function scoreboard(input: { tickers: string[]; status: string; claims: ScoreLine[] }): string {
  const head = input.status === 'PARTIAL' ? '⚠️ Pemeriksaan selesai sebagian' : '✅ Pemeriksaan selesai';
  const who = input.tickers.length ? ` — ${input.tickers.join(', ')}` : '';
  const lines = input.claims.map((c, i) => {
    const v = VERDICT[c.assessment ?? 'UNVERIFIABLE'] ?? VERDICT.UNVERIFIABLE!;
    return `${i + 1}. ${shorten(c.text)} — ${v.mark} ${v.text}`;
  });
  return [`${head}${who}`, '', ...(lines.length ? lines : ['Tidak ada klaim yang bisa diperiksa dari pesan ini.'])].join('\n');
}

export function historyList(items: { id: string; text: string; status: string }[], webUrl: string): string {
  if (!items.length) return 'Belum ada pemeriksaan. Kirim teks postingan saham untuk mulai.';
  const lines = items.map((item, i) => `${i + 1}. ${shorten(item.text)} — ${STATUS[item.status] ?? 'Sedang diperiksa'}\n${webUrl}/t/${item.id}`);
  return ['Pemeriksaan terakhir:', '', ...lines].join('\n');
}

type Key = { text: string; callback_data: string } | { text: string; url: string };

/** Telegram rejects URL buttons that aren't public https links, so those links go into the text instead. */
export function renderMessage(text: string, buttons: Button[][]): { text: string; keyboard: Key[][] } {
  const extra: string[] = [];
  const keyboard = buttons
    .map((row) => row.flatMap((b): Key[] => {
      if (b.url) {
        if (/^https:\/\/(?!localhost|127\.)/.test(b.url)) return [{ text: b.text, url: b.url }];
        extra.push(`${b.text}: ${b.url}`);
        return [];
      }
      return b.data ? [{ text: b.text, callback_data: b.data }] : [];
    }))
    .filter((row) => row.length > 0);
  return { text: extra.length ? `${text}\n\n${extra.join('\n')}` : text, keyboard };
}

export const MENU: Button[][] = [[
  { text: 'Cek klaim', data: 'menu:check' },
  { text: 'Riwayat', data: 'menu:history' },
  { text: 'Bantuan', data: 'menu:help' },
]];

export const COPY = {
  welcome: (name: string) => `Halo ${name}! Kirim teks postingan saham atau screenshot-nya. Aku periksa setiap klaimnya dengan data Sectors, lalu kirim hasilnya ke sini.`,
  linked: (name: string) => `Terhubung sebagai ${name} ✅`,
  codeInvalid: 'Kode kedaluwarsa atau sudah dipakai. Buat kode baru di website.',
  notLinked: 'Akun Telegram ini belum terhubung ke Counterpoint. Hubungkan dulu dari halaman Integrasi di website.',
  askClaim: 'Kirim teks postingan saham atau screenshot-nya.',
  tooShort: 'Kirim teks lengkap postingannya, ya. Minimal 10 karakter.',
  tooLong: 'Pesannya terlalu panjang. Maksimal 2000 karakter.',
  busy: 'Tunggu pemeriksaan sebelumnya selesai dulu.',
  rateLimited: 'Batas pemeriksaan tercapai. Coba lagi nanti.',
  startFailed: 'Pemeriksaan belum bisa dimulai. Coba lagi sebentar lagi.',
  checking: '🔎 Memeriksa… Hasilnya aku kirim ke sini begitu selesai.',
  readingImage: 'Membaca screenshot…',
  imageRead: (text: string) => `Teks yang terbaca:\n\n${text}\n\nPeriksa teks ini?`,
  imageFailed: 'Screenshot tidak bisa dibaca. Coba kirim teksnya langsung.',
  imageTooLarge: 'Gambarnya terlalu besar. Maksimal 4 MB.',
  noPending: 'Teks ini sudah tidak tersedia. Kirim ulang screenshot-nya.',
  cancelled: 'Dibatalkan.',
  whichTicker: (mention: string) => `Yang kamu maksud "${mention}" yang mana?`,
  pickOnWeb: 'Aku belum yakin saham mana yang dimaksud. Pilih sahamnya di website, nanti hasilnya tetap aku kirim ke sini.',
  chosen: (ticker: string) => `Dipilih: ${ticker}. Melanjutkan pemeriksaan…`,
  choiceExpired: 'Pilihan ini sudah tidak berlaku.',
  failed: (reason: string | null) => `Pemeriksaan terhenti${reason ? `: ${reason}` : '.'}`,
  timedOut: 'Pemeriksaan ini makan waktu lebih lama dari biasanya. Cek hasilnya di website.',
  unlinked: 'Telegram sudah diputuskan dari akun Counterpoint-mu. Pemeriksaan sebelumnya tetap ada di riwayat website.',
  help: 'Cara pakai:\n1. Kirim teks postingan saham atau screenshot-nya.\n2. Aku pecah jadi klaim-klaim dan memeriksa masing-masing dengan data Sectors.\n3. Hasilnya aku kirim ke sini, lengkap dengan tautan ke analisis di website.\n\nPerintah: /riwayat, /putuskan, /bantuan\n\nInformasi ini bukan rekomendasi beli, jual, atau tahan saham.',
} as const;
