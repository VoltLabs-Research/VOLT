import type { ColumnType } from 'typeorm';
import { getDatabaseDialect } from '@shared/infrastructure/persistence/dialect';

const dialect = getDatabaseDialect();

export const JSON_COLUMN_TYPE: ColumnType = dialect === 'sqlite' ? 'simple-json' : 'jsonb';

export const TIMESTAMP_COLUMN_TYPE: ColumnType = dialect === 'sqlite' ? 'datetime' : 'timestamptz';

export const BIG_INTEGER_COLUMN_TYPE: ColumnType = dialect === 'sqlite' ? 'integer' : 'bigint';

export const AUTO_INCREMENT_COLUMN_TYPE: 'integer' | 'bigint' = dialect === 'sqlite' ? 'integer' : 'bigint';

export const jsonColumnDefault = (literal: string): (() => string) =>
    dialect === 'sqlite'
        ? () => `'${literal}'`
        : () => `'${literal}'::jsonb`;
