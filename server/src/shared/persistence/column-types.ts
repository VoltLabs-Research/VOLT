import type { ColumnType } from 'typeorm';
import { getDatabaseDialect } from '@shared/persistence/dialect';

const dialect = getDatabaseDialect();

export const JSON_COLUMN_TYPE: ColumnType = dialect === 'sqlite' ? 'simple-json' : 'jsonb';

export const TIMESTAMP_COLUMN_TYPE: ColumnType = dialect === 'sqlite' ? 'datetime' : 'timestamptz';

export const AUTO_INCREMENT_COLUMN_TYPE: 'integer' | 'bigint' = dialect === 'sqlite' ? 'integer' : 'bigint';
