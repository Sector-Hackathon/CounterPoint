import { describe, expect, it } from 'vitest';
import { isWorkspacePath } from '../lib/routes';

describe('isWorkspacePath', () => {
  it('covers every page inside the signed-in workspace', () => {
    for (const path of ['/check', '/history', '/integrations', '/t/abc', '/t/abc/report']) expect(isWorkspacePath(path)).toBe(true);
  });

  it('leaves the public pages out', () => {
    for (const path of ['/', '/sign-in', '/sign-up', '/integrationsx']) expect(isWorkspacePath(path)).toBe(false);
  });
});
