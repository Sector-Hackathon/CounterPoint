import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthRequest } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { toEvidence } from '../common/mappers';

@Controller('claims')
@UseGuards(AuthGuard)
export class EvidenceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id/evidence')
  async evidence(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthRequest) {
    const claim = await this.prisma.claim.findFirst({
      where: { id, session: { userId: request.user.id } },
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
