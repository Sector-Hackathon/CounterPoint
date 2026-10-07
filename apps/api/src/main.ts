import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

async function bootstrap() {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create<import('@nestjs/platform-express').NestExpressApplication>(AppModule);
  // Behind Railway's proxy: take the client IP from X-Forwarded-For for rate limiting.
  app.set('trust proxy', 1);
  // Screenshot uploads (POST /theses/extract-text) carry up to ~4 MB of base64.
  app.useBodyParser('json', { limit: '6mb' });
  const origins = (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
