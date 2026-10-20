import { QueryFailedError } from 'typeorm';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const SQLITE_UNIQUE_VIOLATION = 'SQLITE_CONSTRAINT_UNIQUE';

export const isUniqueViolation = (error: unknown): boolean => {
    if (!(error instanceof QueryFailedError)) {
        return false;
    }

    const code = String((error.driverError as { code?: string | number } | undefined)?.code);

    return code === POSTGRES_UNIQUE_VIOLATION || code.startsWith(SQLITE_UNIQUE_VIOLATION);
};
