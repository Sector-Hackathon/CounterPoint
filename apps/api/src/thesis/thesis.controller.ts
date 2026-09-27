import { BadRequestException, Body, Controller, Get, HttpCode, Ip, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { UsageLimiter } from './usage-limiter';
import { z } from 'zod';
import { ThesisService } from './thesis.service';
import { InvestigationService } from '../investigation/investigation.service';
import { ReportsService } from '../reports/reports.service';

const CreateThesis = z.object({ thesis: z.string().trim().min(10).max(2000) });
const ConfirmEntity = z.object({ ticker: z.string().trim().min(2).max(10) });

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const r = schema.safeParse(body);
  if (!r.success) throw new BadRequestException(r.error.flatten());
  return r.data;
}

@Controller('theses')
export class ThesisController {
  constructor(
    private readonly theses: ThesisService,
    private readonly investigation: InvestigationService,
    private readonly reports: ReportsService,
    private readonly limiter: UsageLimiter,
  ) {}

  @Post()
  async create(@Body() body: unknown, @Ip() ip: string) {
    const { thesis } = parse(CreateThesis, body);
    await this.limiter.check(ip);
    const session = await this.theses.create(thesis);
    return { id: session.id, status: session.status };
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.theses.get(id);
  }

  @Post(':id/entities/:entityId/confirm')
  confirm(@Param('id', ParseUUIDPipe) id: string, @Param('entityId', ParseUUIDPipe) entityId: string, @Body() body: unknown) {
    return this.theses.confirmEntity(id, entityId, parse(ConfirmEntity, body).ticker);
  }

  @Post(':id/investigate')
  @HttpCode(202)
  async investigate(@Param('id', ParseUUIDPipe) id: string) {
    const started = await this.investigation.start(id);
    const session = await this.theses.get(id);
    return { id, status: session.status, started };
  }

  @Get(':id/report')
  async report(@Param('id', ParseUUIDPipe) id: string) {
    const report = await this.reports.latest(id);
    if (!report) throw new NotFoundException('report not ready');
    return report;
  }

  @Get(':id/trace')
  trace(@Param('id', ParseUUIDPipe) id: string) {
    return this.theses.trace(id);
  }
}
