import { Injectable, Logger } from '@nestjs/common';
import { DISCLAIMER, type CheckState, type ClaimReport, type FrozenPeerSet, type Report, type ValidationIssue } from '@counterpoint/domain';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { INTERPRETATION_SYSTEM, InterpretationSchema, PROMPT_VERSION } from '../llm/prompts';
import { toClaim, toEvidence } from '../common/mappers';
import { composeClaimReport, validateClaimReport } from './composer';
import type { StopReason, Coverage, Assessment } from '@counterpoint/domain';

interface StoredCheckStates {
  states: CheckState[];
  coverage: Coverage | null;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async build(sessionId: string): Promise<Report> {
    const claims = await this.prisma.claim.findMany({
      where: { sessionId },
      include: { evidence: true },
      orderBy: { ordinal: 'asc' },
    });

    const sections: ClaimReport[] = [];
    const issues: ValidationIssue[] = [];
    for (const row of claims) {
      const claim = toClaim(row);
      const evidence = row.evidence.map(toEvidence);
      const stored = (row.checkStates as unknown as StoredCheckStates | null) ?? { states: [], coverage: null };
      let section = composeClaimReport({
        claim,
        assessment: (row.assessment as Assessment | null) ?? 'UNVERIFIABLE',
        coverage: stored.coverage,
        states: stored.states,
        evidence,
        stopReason: row.stopReason as StopReason | null,
        peerSet: row.peerSet as unknown as FrozenPeerSet | null,
      });
      section.interpretation = await this.interpret(claim.normalizedText, section);
      const validated = validateClaimReport(section, evidence);
      section = validated.report;
      issues.push(...validated.issues);
      sections.push(section);
    }

    const saved = await this.prisma.report.create({
      data: {
        sessionId,
        content: { claims: sections, disclaimer: DISCLAIMER } as object,
        validationStatus: issues.length ? 'REPAIRED' : 'VALID',
        validationIssues: issues as unknown as object,
        modelVersion: this.llm.available ? this.llm.model : null,
        promptVersion: PROMPT_VERSION,
      },
    });
    await this.prisma.thesisSession.update({ where: { id: sessionId }, data: { finalReportId: saved.id } });
    return {
      id: saved.id,
      sessionId,
      claims: sections,
      disclaimer: DISCLAIMER,
      validationStatus: saved.validationStatus as Report['validationStatus'],
      validationIssues: issues.map((i) => `${i.kind}: ${i.detail}`),
      createdAt: saved.createdAt.toISOString(),
    };
  }

  /** Optional bounded interpretation; any number or advice not backed by evidence is stripped by the validator. */
  private async interpret(claimText: string, section: ClaimReport) {
    const statements = [...section.supports, ...section.weakens, ...section.context];
    if (!this.llm.available || statements.length === 0) return null;
    const lines = statements.map((s) => `[${s.evidenceIds.join(',')}] ${s.text}`).join('\n');
    try {
      const out = await this.llm.parse(InterpretationSchema, {
        system: INTERPRETATION_SYSTEM,
        user: `Claim: ${claimText}\nAssessment (fixed): ${section.assessment}\nCoverage: ${section.coverage.label}\nEvidence lines:\n${lines}\nMissing: ${section.missing.join('; ') || 'none'}`,
        effort: 'low',
        maxTokens: 1500,
        label: 'interpretation',
      });
      return { text: out.text, evidenceIds: out.evidence_ids };
    } catch (err) {
      this.logger.warn(`interpretation skipped: ${(err as Error).message}`);
      return null;
    }
  }

  async latest(sessionId: string): Promise<Report | null> {
    const r = await this.prisma.report.findFirst({ where: { sessionId }, orderBy: { createdAt: 'desc' } });
    if (!r) return null;
    const content = r.content as unknown as { claims: ClaimReport[]; disclaimer: string };
    return {
      id: r.id,
      sessionId,
      claims: content.claims,
      disclaimer: content.disclaimer,
      validationStatus: r.validationStatus as Report['validationStatus'],
      validationIssues: (r.validationIssues as unknown as ValidationIssue[]).map((i) => `${i.kind}: ${i.detail}`),
      createdAt: r.createdAt.toISOString(),
    };
  }
}
