import { Controller, Get, Inject, Module } from '@nestjs/common';
import { CONTRACTS } from '@counterpoint/domain';
import { PrismaModule } from './prisma/prisma.service';
import { SECTORS_MODE, SectorsModule } from './sectors/sectors.module';
import { LlmService } from './llm/llm.service';
import { ClaimsService } from './claims/claims.service';
import { EntityService } from './entity/entity.service';
import { ReportsService } from './reports/reports.service';
import { InvestigationService } from './investigation/investigation.service';
import { ThesisService } from './thesis/thesis.service';
import { ThesisController } from './thesis/thesis.controller';
import { UsageLimiter } from './thesis/usage-limiter';
import { EvidenceController } from './evidence/evidence.controller';

@Controller()
class HealthController {
  constructor(
    private readonly llm: LlmService,
    @Inject(SECTORS_MODE) private readonly dataMode: 'live' | 'fixture',
  ) {}

  @Get('health')
  health() {
    return {
      ok: true,
      dataMode: this.dataMode,
      llm: this.llm.available ? this.llm.model : null,
      contracts: Object.values(CONTRACTS).map((c) => ({ id: c.id, claimType: c.claimType, provisional: c.provisional })),
    };
  }
}

@Module({
  imports: [PrismaModule, SectorsModule],
  controllers: [HealthController, ThesisController, EvidenceController],
  providers: [LlmService, ClaimsService, EntityService, ReportsService, InvestigationService, ThesisService, UsageLimiter],
})
export class AppModule {}
