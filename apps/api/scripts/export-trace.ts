/**
 * Writes a finished session (claims, trace, evidence, report) to evals/traces/<name>.json so
 * representative runs are committed to the repository (PRD section 23).
 *
 *   pnpm --filter @counterpoint/api export-trace <sessionId> <name>
 */
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [sessionId, name] = process.argv.slice(2);
if (!sessionId || !name) {
  console.error('usage: export-trace <sessionId> <name>');
  process.exit(1);
}
const prisma = new PrismaClient();

async function main() {
  const session = await prisma.thesisSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      entities: true,
      reports: { orderBy: { createdAt: 'desc' }, take: 1 },
      claims: {
        orderBy: { ordinal: 'asc' },
        include: { trace: { orderBy: { sequence: 'asc' } }, evidence: { orderBy: { createdAt: 'asc' } } },
      },
    },
  });
  const dir = resolve(process.cwd(), '..', '..', 'evals', 'traces');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(session, null, 2) + '\n');
  console.log(`wrote evals/traces/${name}.json (${session.claims.length} claims, status ${session.status})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
