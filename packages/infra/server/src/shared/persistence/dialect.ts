export type DatabaseDialect = 'postgres' | 'sqlite';

export const SQLITE_URL_SCHEME = 'sqlite:';

export const resolveDatabaseDialect = (databaseUrl: string | undefined): DatabaseDialect =>
    databaseUrl?.startsWith(SQLITE_URL_SCHEME) ? 'sqlite' : 'postgres';

export const getDatabaseDialect = (): DatabaseDialect => resolveDatabaseDialect(process.env.DATABASE_URL);
