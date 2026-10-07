import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard, ThesisOwnerGuard } from './auth.guard';

@Global()
@Module({ controllers: [AuthController], providers: [AuthService, AuthGuard, ThesisOwnerGuard], exports: [AuthService, AuthGuard, ThesisOwnerGuard] })
export class AuthModule {}
