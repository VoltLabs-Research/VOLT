import { DAEMON_PATHS } from '@core/config/paths';

export type DatabaseDialect = 'postgres' | 'sqlite';

const SQLITE_URL_SCHEME = 'sqlite:';

export const resolveDatabaseDialect = (databaseUrl: string): DatabaseDialect =>
    databaseUrl.startsWith(SQLITE_URL_SCHEME) ? 'sqlite' : 'postgres';

export const sqliteDatabasePath = (databaseUrl: string): string =>
    databaseUrl.slice(SQLITE_URL_SCHEME.length);

export const resolveDatabaseUrl = (): string => process.env.DATABASE_URL || `${SQLITE_URL_SCHEME}${DAEMON_PATHS.database}`;

export const getDatabaseDialect = (): DatabaseDialect => resolveDatabaseDialect(resolveDatabaseUrl());
