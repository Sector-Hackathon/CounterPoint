import { describe, expect, it } from 'vitest';
import { ThesisController } from '../src/thesis/thesis.controller';

/**
 * Behind the web app's /api proxy every request reaches the API from the proxy's address, so a
 * per-IP limit would be shared by all visitors. Requests are signed in, so the account is the key.
 */
describe('ThesisController rate limit', () => {
  const keys: string[] = [];
  const controller = new ThesisController(
    { create: async () => ({ id: 's1', status: 'PENDING' }) } as never,
    {} as never,
    {} as never,
    { check: async (key: string) => void keys.push(key) } as never,
    {} as never,
    { readImageText: async () => 'teks' } as never,
  );
  const request = { user: { id: 'u1' } } as never;

  it('counts new checks per signed-in user, not per IP address', async () => {
    keys.length = 0;
    await controller.create({ thesis: 'BBCA laba naik 10% tahun ini.' }, request);
    expect(keys).toEqual(['user:u1']);
  });

  it('counts screenshot reads per signed-in user too', async () => {
    keys.length = 0;
    await controller.extractText({ imageBase64: 'aGVsbG8=', mimeType: 'image/png' }, request);
    expect(keys).toEqual(['user:u1']);
  });
});
