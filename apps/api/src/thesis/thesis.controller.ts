import { BadRequestException, Body, Controller, Get, HttpCode, Ip, type MessageEvent, NotFoundException, Param, ParseUUIDPipe, Post, Sse } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { EventsService } from '../events/events.service';
import { LlmService } from '../llm/llm.service';
import { UsageLimiter } from './usage-limiter';
import { z } from 'zod';
import { ThesisService } from './thesis.service';
import { InvestigationService } from '../investigation/investigation.service';
import { ReportsService } from '../reports/reports.service';

const CreateThesis = z.object({ thesis: z.string().trim().min(10).max(2000) });
const ConfirmEntity = z.object({ ticker: z.string().trim().min(2).max(10) });
export const ExtractTextBody = z.object({
  imageBase64: z.string().min(1).max(5_600_000),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
});

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
    private readonly events: EventsService,
    private readonly llm: LlmService,
  ) {}

  @Post()
  async create(@Body() body: unknown, @Ip() ip: string) {
    const { thesis } = parse(CreateThesis, body);
    await this.limiter.check(ip);
    const session = await this.theses.create(thesis);
    return { id: session.id, status: session.status };
  }

  /** Transcribes a screenshot of a post. Not persisted; the user confirms the text before checking it. */
  @Post('extract-text')
  async extractText(@Body() body: unknown, @Ip() ip: string) {
    const { imageBase64, mimeType } = parse(ExtractTextBody, body);
    await this.limiter.check(ip);
    return { text: await this.llm.readImageText(imageBase64, mimeType) };
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

  @Sse(':id/events')
  stream(@Param('id', ParseUUIDPipe) id: string): Observable<MessageEvent> {
    return this.events.stream(id) as Observable<MessageEvent>;
  }

  /** Read-only replay for browsers whose SSE connection falls back to polling. */
  @Get(':id/event-snapshot')
  eventSnapshot(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.replay(id);
  }

  @Get(':id/trace')
  trace(@Param('id', ParseUUIDPipe) id: string) {
    return this.theses.trace(id);
  }
}
