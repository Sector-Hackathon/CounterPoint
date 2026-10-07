import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { AuthService, type AuthRequest } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    context.switchToHttp().getResponse<{ setHeader(name: string, value: string): void }>().setHeader('Cache-Control', 'private, no-store');
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) this.auth.assertOrigin(request);
    request.user = await this.auth.requireUser(request);
    return true;
  }
}

@Injectable()
export class ThesisOwnerGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (request.params.id) await this.auth.assertOwner(request.user.id, request.params.id);
    return true;
  }
}
