import { Global, Logger, Module } from '@nestjs/common';
import { createSectorsDataSource, type SectorsDataSource } from '@counterpoint/sectors';

export const SECTORS_SOURCE = Symbol('SECTORS_SOURCE');
export const SECTORS_MODE = Symbol('SECTORS_MODE');

const SECTORS = Symbol('SECTORS');
const logger = new Logger('Sectors');

@Global()
@Module({
  providers: [
    {
      provide: SECTORS,
      useFactory: () =>
        createSectorsDataSource({
          apiKey: process.env.SECTORS_API_KEY,
          baseUrl: process.env.SECTORS_BASE_URL,
          onCall: (e) => logger.log(JSON.stringify({ event: 'sectors_call', ...e })),
        }),
    },
    {
      provide: SECTORS_SOURCE,
      inject: [SECTORS],
      useFactory: (s: { source: SectorsDataSource }) => s.source,
    },
    {
      provide: SECTORS_MODE,
      inject: [SECTORS],
      useFactory: (s: { mode: 'live' | 'fixture' }) => s.mode,
    },
  ],
  exports: [SECTORS_SOURCE, SECTORS_MODE],
})
export class SectorsModule {}
