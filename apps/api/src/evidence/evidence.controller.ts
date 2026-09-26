import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toEvidence } from '../common/mappers';

@Controller('claims')
export class EvidenceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id/evidence')
  async evidence(@Param('id', ParseUUIDPipe) id: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id },
      include: { evidence: { orderBy: { createdAt: 'asc' } } },
    });
    if (!claim) throw new NotFoundException('claim not found');
    return {
      claimId: claim.id,
      contractId: claim.contractId,
      peerSet: claim.peerSet,
      items: claim.evidence.map(toEvidence),
    };
  }
}
