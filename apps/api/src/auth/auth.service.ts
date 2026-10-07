import { ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PublicUser { id: string; name: string; email: string }
export interface AuthRequest {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  params: { id?: string };
  user: PublicUser;
}
const COOKIE_NAME = 'counterpoint_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
});
const publicUser = (user: PublicUser): PublicUser => ({ id: user.id, name: user.name, email: user.email });

@Injectable()
export class AuthService {
  private readonly attempts = new Map<string, { count: number; expires: number }>();
  constructor(private readonly prisma: PrismaService) {}

  assertOrigin(request: AuthRequest) {
    const origin = request.headers.origin;
    if (!origin) return; // Non-browser clients do not carry an Origin header.
    const allowed = (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',').map((value) => value.trim());
    if (typeof origin !== 'string' || !allowed.includes(origin)) throw new ForbiddenException('Origin tidak diizinkan.');
  }

  limit(ip: string) {
    const now = Date.now();
    if (this.attempts.size > 10_000) for (const [key, value] of this.attempts) if (value.expires <= now) this.attempts.delete(key);
    const previous = this.attempts.get(ip);
    const entry = previous && previous.expires > now ? previous : { count: 0, expires: now + 15 * 60_000 };
    if (entry.count >= 20) throw new HttpException('Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.', 429);
    entry.count++; this.attempts.set(ip, entry);
  }

  private token(request: AuthRequest): string | null {
    const cookie = request.headers.cookie;
    if (typeof cookie !== 'string') return null;
    const value = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
    return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
  }

  async currentUser(request: AuthRequest): Promise<PublicUser | null> {
    const token = this.token(request);
    if (!token) return null;
    const session = await this.prisma.authSession.findUnique({ where: { tokenHash: digest(token) }, include: { user: true } });
    return session && session.expiresAt.getTime() > Date.now() ? publicUser(session.user) : null;
  }

  async requireUser(request: AuthRequest) {
    const user = await this.currentUser(request);
    if (!user) throw new UnauthorizedException('Silakan masuk untuk melanjutkan.');
    return user;
  }

  cookie(token: string | null) {
    const sameSite = process.env.AUTH_COOKIE_SAME_SITE === 'none' ? 'None' : 'Lax';
    const secure = sameSite === 'None' || process.env.AUTH_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
    return `${COOKIE_NAME}=${token ?? ''}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${token ? SESSION_SECONDS : 0}${secure ? '; Secure' : ''}`;
  }

  async signup(input: { name: string; email: string; password: string }) {
    const salt = randomBytes(16).toString('hex');
    const passwordHash = `scrypt-v1$${salt}$${(await derive(input.password, salt)).toString('hex')}`;
    const token = randomBytes(32).toString('hex');
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({ data: { name: input.name, email: input.email, passwordHash } });
        await tx.authSession.create({ data: { userId: created.id, tokenHash: digest(token), expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) } });
        return created;
      });
      return { user: publicUser(user), token };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Email sudah terdaftar. Silakan masuk.');
      throw error;
    }
  }

  async signin(input: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const [, salt, stored] = (user?.passwordHash ?? `scrypt-v1$00000000000000000000000000000000$${'0'.repeat(128)}`).split('$');
    const key = await derive(input.password, salt ?? '00000000000000000000000000000000');
    const expected = Buffer.from(stored ?? '', 'hex');
    const valid = key.length === expected.length && timingSafeEqual(key, expected);
    if (!user || !valid) throw new UnauthorizedException('Email atau password tidak cocok.');
    const token = randomBytes(32).toString('hex');
    await this.prisma.authSession.create({ data: { userId: user.id, tokenHash: digest(token), expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) } });
    return { user: publicUser(user), token };
  }

  async signout(request: AuthRequest) {
    const token = this.token(request);
    if (token) await this.prisma.authSession.deleteMany({ where: { tokenHash: digest(token) } });
  }

  async assertOwner(userId: string, sessionId: string) {
    const session = await this.prisma.thesisSession.findFirst({ where: { id: sessionId, userId }, select: { id: true } });
    if (!session) throw new NotFoundException('Pemeriksaan tidak ditemukan atau bukan milik akunmu.');
  }
}
