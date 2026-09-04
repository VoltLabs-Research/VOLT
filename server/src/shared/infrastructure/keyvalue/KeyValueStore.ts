import KeyValueEntry from '@shared/infrastructure/persistence/models/KeyValueEntry';
import { getDatabaseDialect } from '@shared/infrastructure/persistence/dialect';
import { sqliteNow, toSqliteDateTimeOrNull } from '@shared/infrastructure/persistence/sqlite-time';
import type { EntityManager } from 'typeorm';


interface KeyValueTtlOptions {
    ttlMs?: number;
}

interface KeyValueWriteOptions extends KeyValueTtlOptions {
    ifNotExists?: boolean;
}

const KEY_CHUNK_SIZE = 500;

const deadlineFromMs = (ttlMs: number | undefined): Date | null =>
    ttlMs === undefined ? null : new Date(Date.now() + ttlMs);

const placeholders = (count: number): string => Array.from({ length: count }, () => '?').join(', ');

const chunked = <T>(items: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let offset = 0; offset < items.length; offset += size) {
        chunks.push(items.slice(offset, offset + size));
    }

    return chunks;
};

export abstract class KeyValueStore {
    constructor(protected readonly manager: EntityManager) {}

    protected abstract withManager(manager: EntityManager): KeyValueStore;

    protected abstract acquireLock(name: string): Promise<void>;

    abstract get(key: string): Promise<string | null>;
    abstract getMany(keys: string[]): Promise<(string | null)[]>;
    abstract set(key: string, value: string, options?: KeyValueWriteOptions): Promise<boolean>;
    abstract adjust(key: string, delta: number, options?: KeyValueTtlOptions): Promise<number>;
    abstract exists(key: string): Promise<boolean>;
    abstract expire(key: string, ttlMs: number): Promise<boolean>;
    abstract deleteReturningPresent(keys: string[]): Promise<string[]>;
    abstract deleteIfValue(key: string, value: string): Promise<boolean>;
    abstract setAdd(key: string, members: string[], options?: KeyValueTtlOptions): Promise<void>;
    abstract setRemove(key: string, members: string[]): Promise<void>;
    abstract setMembers(key: string): Promise<string[]>;
    abstract setCount(key: string): Promise<number>;
    abstract setExpire(key: string, ttlMs: number): Promise<void>;
    abstract deleteSets(keys: string[]): Promise<void>;
    abstract sweepExpired(): Promise<number>;

    async delete(keys: string[]): Promise<number> {
        return (await this.deleteReturningPresent(keys)).length;
    }

    withLock<R>(name: string, work: (store: KeyValueStore) => Promise<R>): Promise<R> {
        return this.transaction(async (store) => {
            await store.acquireLock(name);
            return work(store);
        });
    }

    transaction<R>(work: (store: KeyValueStore) => Promise<R>): Promise<R> {
        if (this.manager.queryRunner?.isTransactionActive) {
            return work(this);
        }

        return this.manager.transaction((transactional) => work(this.withManager(transactional)));
    }
}

const PG_LIVE = '("expiresAt" IS NULL OR "expiresAt" > now())';

class PostgresKeyValueStore extends KeyValueStore {
    protected withManager(manager: EntityManager): KeyValueStore {
        return new PostgresKeyValueStore(manager);
    }

    protected async acquireLock(name: string): Promise<void> {
        await this.manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [name]);
    }

    async get(key: string): Promise<string | null> {
        const rows = await this.manager.query<{ value: string }[]>(
            `SELECT value FROM key_value_entries WHERE key = $1 AND ${PG_LIVE}`,
            [key]
        );

        return rows[0]?.value ?? null;
    }

    async getMany(keys: string[]): Promise<(string | null)[]> {
        if (keys.length === 0) {
            return [];
        }

        const rows = await this.manager.query<{ key: string; value: string }[]>(
            `SELECT key, value FROM key_value_entries WHERE key = ANY($1) AND ${PG_LIVE}`,
            [keys]
        );

        const found = new Map(rows.map((row) => [row.key, row.value]));
        return keys.map((key) => found.get(key) ?? null);
    }

    async set(key: string, value: string, options: KeyValueWriteOptions = {}): Promise<boolean> {
        const guard = options.ifNotExists
            ? 'WHERE target."expiresAt" IS NOT NULL AND target."expiresAt" <= now()'
            : '';

        const rows = await this.manager.query<{ key: string }[]>(
            `INSERT INTO key_value_entries AS target (key, value, "expiresAt")
             VALUES ($1, $2, $3)
             ON CONFLICT (key) DO UPDATE
                 SET value = excluded.value, "expiresAt" = excluded."expiresAt"
                 ${guard}
             RETURNING target.key`,
            [key, value, deadlineFromMs(options.ttlMs)]
        );

        return rows.length > 0;
    }

    async adjust(key: string, delta: number, options: KeyValueTtlOptions = {}): Promise<number> {
        const deadline = deadlineFromMs(options.ttlMs);
        const rows = await this.manager.query<{ value: string }[]>(
            `INSERT INTO key_value_entries AS target (key, value, "expiresAt")
             VALUES ($1, $2::text, $3)
             ON CONFLICT (key) DO UPDATE
                 SET value = ((CASE
                         WHEN target."expiresAt" IS NOT NULL AND target."expiresAt" <= now() THEN 0
                         ELSE target.value::bigint
                     END) + $2::bigint)::text,
                     "expiresAt" = CASE
                         WHEN target."expiresAt" IS NOT NULL AND target."expiresAt" <= now() THEN $3
                         ELSE COALESCE($3, target."expiresAt")
                     END
             RETURNING target.value`,
            [key, String(delta), deadline]
        );

        return Number(rows[0]?.value ?? delta);
    }

    async exists(key: string): Promise<boolean> {
        const rows = await this.manager.query<{ key: string }[]>(
            `SELECT key FROM key_value_entries WHERE key = $1 AND ${PG_LIVE}`,
            [key]
        );

        return rows.length > 0;
    }

    async expire(key: string, ttlMs: number): Promise<boolean> {
        const rows = await this.manager.query<{ key: string }[]>(
            `WITH refreshed AS (
                 UPDATE key_value_entries SET "expiresAt" = $2
                 WHERE key = $1 AND ${PG_LIVE}
                 RETURNING key
             ) SELECT key FROM refreshed`,
            [key, deadlineFromMs(ttlMs)]
        );

        return rows.length > 0;
    }

    async deleteReturningPresent(keys: string[]): Promise<string[]> {
        if (keys.length === 0) {
            return [];
        }

        const rows = await this.manager.query<{ key: string }[]>(
            `WITH removed AS (
                 DELETE FROM key_value_entries WHERE key = ANY($1) AND ${PG_LIVE} RETURNING key
             ) SELECT key FROM removed`,
            [keys]
        );

        return rows.map((row) => row.key);
    }

    async deleteIfValue(key: string, value: string): Promise<boolean> {
        const rows = await this.manager.query<{ key: string }[]>(
            'WITH released AS (DELETE FROM key_value_entries WHERE key = $1 AND value = $2 RETURNING key) SELECT key FROM released',
            [key, value]
        );

        return rows.length > 0;
    }

    async setAdd(key: string, members: string[], options: KeyValueTtlOptions = {}): Promise<void> {
        if (members.length === 0) {
            return;
        }

        await this.manager.query(
            `INSERT INTO key_value_set_members (key, member, "expiresAt")
             SELECT $1, source.member, $3 FROM unnest($2::text[]) AS source(member)
             ON CONFLICT (key, member) DO UPDATE SET "expiresAt" = excluded."expiresAt"`,
            [key, members, deadlineFromMs(options.ttlMs)]
        );
    }

    async setRemove(key: string, members: string[]): Promise<void> {
        if (members.length === 0) {
            return;
        }

        await this.manager.query(
            'DELETE FROM key_value_set_members WHERE key = $1 AND member = ANY($2)',
            [key, members]
        );
    }

    async setMembers(key: string): Promise<string[]> {
        const rows = await this.manager.query<{ member: string }[]>(
            `SELECT member FROM key_value_set_members WHERE key = $1 AND ${PG_LIVE}`,
            [key]
        );

        return rows.map((row) => row.member);
    }

    async setCount(key: string): Promise<number> {
        const rows = await this.manager.query<{ total: string }[]>(
            `SELECT count(*)::text AS total FROM key_value_set_members WHERE key = $1 AND ${PG_LIVE}`,
            [key]
        );

        return Number(rows[0]?.total ?? 0);
    }

    async setExpire(key: string, ttlMs: number): Promise<void> {
        await this.manager.query(
            `UPDATE key_value_set_members SET "expiresAt" = $2 WHERE key = $1 AND ${PG_LIVE}`,
            [key, deadlineFromMs(ttlMs)]
        );
    }

    async deleteSets(keys: string[]): Promise<void> {
        if (keys.length === 0) {
            return;
        }

        await this.manager.query('DELETE FROM key_value_set_members WHERE key = ANY($1)', [keys]);
    }

    async sweepExpired(): Promise<number> {
        const [entries, members] = await Promise.all([
            this.manager.query<{ key: string }[]>(
                'WITH swept AS (DELETE FROM key_value_entries WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= now() RETURNING key) SELECT key FROM swept'
            ),
            this.manager.query<{ key: string }[]>(
                'WITH swept AS (DELETE FROM key_value_set_members WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= now() RETURNING key) SELECT key FROM swept'
            )
        ]);

        return entries.length + members.length;
    }
}

const SQLITE_LIVE = '("expiresAt" IS NULL OR "expiresAt" > ?)';

class SqliteKeyValueStore extends KeyValueStore {
    protected withManager(manager: EntityManager): KeyValueStore {
        return new SqliteKeyValueStore(manager);
    }

    protected async acquireLock(): Promise<void> {}

    async get(key: string): Promise<string | null> {
        const rows = await this.manager.query<{ value: string }[]>(
            `SELECT value FROM key_value_entries WHERE key = ? AND ${SQLITE_LIVE}`,
            [key, sqliteNow()]
        );

        return rows[0]?.value ?? null;
    }

    async getMany(keys: string[]): Promise<(string | null)[]> {
        if (keys.length === 0) {
            return [];
        }

        const found = new Map<string, string>();
        for (const chunk of chunked(keys, KEY_CHUNK_SIZE)) {
            const rows = await this.manager.query<{ key: string; value: string }[]>(
                `SELECT key, value FROM key_value_entries WHERE key IN (${placeholders(chunk.length)}) AND ${SQLITE_LIVE}`,
                [...chunk, sqliteNow()]
            );
            for (const row of rows) {
                found.set(row.key, row.value);
            }
        }

        return keys.map((key) => found.get(key) ?? null);
    }

    async set(key: string, value: string, options: KeyValueWriteOptions = {}): Promise<boolean> {
        const deadline = toSqliteDateTimeOrNull(deadlineFromMs(options.ttlMs));
        const guard = options.ifNotExists
            ? 'WHERE key_value_entries."expiresAt" IS NOT NULL AND key_value_entries."expiresAt" <= ?'
            : '';
        const parameters = options.ifNotExists
            ? [key, value, deadline, sqliteNow()]
            : [key, value, deadline];

        const rows = await this.manager.query<{ key: string }[]>(
            `INSERT INTO key_value_entries (key, value, "expiresAt")
             VALUES (?, ?, ?)
             ON CONFLICT (key) DO UPDATE
                 SET value = excluded.value, "expiresAt" = excluded."expiresAt"
                 ${guard}
             RETURNING key`,
            parameters
        );

        return rows.length > 0;
    }

    async adjust(key: string, delta: number, options: KeyValueTtlOptions = {}): Promise<number> {
        const deadline = toSqliteDateTimeOrNull(deadlineFromMs(options.ttlMs));
        const now = sqliteNow();
        const rows = await this.manager.query<{ value: string }[]>(
            `INSERT INTO key_value_entries (key, value, "expiresAt")
             VALUES (?, ?, ?)
             ON CONFLICT (key) DO UPDATE
                 SET value = CAST(((CASE
                         WHEN key_value_entries."expiresAt" IS NOT NULL AND key_value_entries."expiresAt" <= ? THEN 0
                         ELSE CAST(key_value_entries.value AS INTEGER)
                     END) + ?) AS TEXT),
                     "expiresAt" = CASE
                         WHEN key_value_entries."expiresAt" IS NOT NULL AND key_value_entries."expiresAt" <= ? THEN ?
                         ELSE COALESCE(?, key_value_entries."expiresAt")
                     END
             RETURNING value`,
            [key, String(delta), deadline, now, delta, now, deadline, deadline]
        );

        return Number(rows[0]?.value ?? delta);
    }

    async exists(key: string): Promise<boolean> {
        const rows = await this.manager.query<{ key: string }[]>(
            `SELECT key FROM key_value_entries WHERE key = ? AND ${SQLITE_LIVE}`,
            [key, sqliteNow()]
        );

        return rows.length > 0;
    }

    async expire(key: string, ttlMs: number): Promise<boolean> {
        const rows = await this.manager.query<{ key: string }[]>(
            `UPDATE key_value_entries SET "expiresAt" = ?
             WHERE key = ? AND ${SQLITE_LIVE}
             RETURNING key`,
            [toSqliteDateTimeOrNull(deadlineFromMs(ttlMs)), key, sqliteNow()]
        );

        return rows.length > 0;
    }

    async deleteReturningPresent(keys: string[]): Promise<string[]> {
        if (keys.length === 0) {
            return [];
        }

        const removed: string[] = [];
        for (const chunk of chunked(keys, KEY_CHUNK_SIZE)) {
            const rows = await this.manager.query<{ key: string }[]>(
                `DELETE FROM key_value_entries WHERE key IN (${placeholders(chunk.length)}) AND ${SQLITE_LIVE} RETURNING key`,
                [...chunk, sqliteNow()]
            );
            removed.push(...rows.map((row) => row.key));
        }

        return removed;
    }

    async deleteIfValue(key: string, value: string): Promise<boolean> {
        const rows = await this.manager.query<{ key: string }[]>(
            'DELETE FROM key_value_entries WHERE key = ? AND value = ? RETURNING key',
            [key, value]
        );

        return rows.length > 0;
    }

    async setAdd(key: string, members: string[], options: KeyValueTtlOptions = {}): Promise<void> {
        if (members.length === 0) {
            return;
        }

        const deadline = toSqliteDateTimeOrNull(deadlineFromMs(options.ttlMs));
        for (const chunk of chunked(members, KEY_CHUNK_SIZE)) {
            await this.manager.query(
                `INSERT INTO key_value_set_members (key, member, "expiresAt")
                 VALUES ${chunk.map(() => '(?, ?, ?)').join(', ')}
                 ON CONFLICT (key, member) DO UPDATE SET "expiresAt" = excluded."expiresAt"`,
                chunk.flatMap((member) => [key, member, deadline])
            );
        }
    }

    async setRemove(key: string, members: string[]): Promise<void> {
        if (members.length === 0) {
            return;
        }

        for (const chunk of chunked(members, KEY_CHUNK_SIZE)) {
            await this.manager.query(
                `DELETE FROM key_value_set_members WHERE key = ? AND member IN (${placeholders(chunk.length)})`,
                [key, ...chunk]
            );
        }
    }

    async setMembers(key: string): Promise<string[]> {
        const rows = await this.manager.query<{ member: string }[]>(
            `SELECT member FROM key_value_set_members WHERE key = ? AND ${SQLITE_LIVE}`,
            [key, sqliteNow()]
        );

        return rows.map((row) => row.member);
    }

    async setCount(key: string): Promise<number> {
        const rows = await this.manager.query<{ total: number }[]>(
            `SELECT count(*) AS total FROM key_value_set_members WHERE key = ? AND ${SQLITE_LIVE}`,
            [key, sqliteNow()]
        );

        return Number(rows[0]?.total ?? 0);
    }

    async setExpire(key: string, ttlMs: number): Promise<void> {
        await this.manager.query(
            `UPDATE key_value_set_members SET "expiresAt" = ? WHERE key = ? AND ${SQLITE_LIVE}`,
            [toSqliteDateTimeOrNull(deadlineFromMs(ttlMs)), key, sqliteNow()]
        );
    }

    async deleteSets(keys: string[]): Promise<void> {
        if (keys.length === 0) {
            return;
        }

        for (const chunk of chunked(keys, KEY_CHUNK_SIZE)) {
            await this.manager.query(
                `DELETE FROM key_value_set_members WHERE key IN (${placeholders(chunk.length)})`,
                chunk
            );
        }
    }

    async sweepExpired(): Promise<number> {
        const now = sqliteNow();
        const entries = await this.manager.query<{ key: string }[]>(
            'DELETE FROM key_value_entries WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= ? RETURNING key',
            [now]
        );
        const members = await this.manager.query<{ key: string }[]>(
            'DELETE FROM key_value_set_members WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= ? RETURNING key',
            [now]
        );

        return entries.length + members.length;
    }
}

const createKeyValueStore = (manager: EntityManager): KeyValueStore =>
    getDatabaseDialect() === 'sqlite' ? new SqliteKeyValueStore(manager) : new PostgresKeyValueStore(manager);

export const getKeyValueStore = (): KeyValueStore =>
    createKeyValueStore(KeyValueEntry.getRepository().manager);

export const sweepExpiredKeyValues = (): Promise<number> =>
    createKeyValueStore(KeyValueEntry.getRepository().manager).sweepExpired();
