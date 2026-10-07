import { BadRequestException, Body, Controller, Get, HttpCode, Ip, Post, Req, Res } from '@nestjs/common';
import { z } from 'zod';
import { AuthService, type AuthRequest } from './auth.service';

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const Signup = z.object({ name: z.string().trim().min(2).max(80), email, password: z.string().min(10).max(128) });
const Signin = z.object({ email, password: z.string().min(1).max(128) });
interface CookieResponse { setHeader(name: string, value: string): unknown }
const parse = <T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> => {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException('Data akun tidak valid. Periksa nama, email, dan panjang password.');
  return result.data;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('sign-up')
  async signup(@Body() body: unknown, @Req() request: AuthRequest, @Res({ passthrough: true }) response: CookieResponse, @Ip() ip: string) {
    this.auth.assertOrigin(request); this.auth.limit(ip);
    const result = await this.auth.signup(parse(Signup, body));
    response.setHeader('Set-Cookie', this.auth.cookie(result.token));
    return { user: result.user };
  }
  @Post('sign-in')
  @HttpCode(200)
  async signin(@Body() body: unknown, @Req() request: AuthRequest, @Res({ passthrough: true }) response: CookieResponse, @Ip() ip: string) {
    this.auth.assertOrigin(request); this.auth.limit(ip);
    const result = await this.auth.signin(parse(Signin, body));
    response.setHeader('Set-Cookie', this.auth.cookie(result.token));
    return { user: result.user };
  }
  @Get('me')
  async me(@Req() request: AuthRequest, @Res({ passthrough: true }) response: CookieResponse) {
    response.setHeader('Cache-Control', 'no-store');
    return { user: await this.auth.currentUser(request) };
  }
  @Post('sign-out')
  @HttpCode(200)
  async signout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: CookieResponse) {
    this.auth.assertOrigin(request);
    await this.auth.signout(request);
    response.setHeader('Set-Cookie', this.auth.cookie(null));
    return { ok: true };
  }
}
