import KeyValueEntry from '@shared/infrastructure/persistence/models/KeyValueEntry';
import type { EntityManager } from 'typeorm';


interface KeyValueTtlOptions {
    ttlMs?: number;
}

interface KeyValueWriteOptions extends KeyValueTtlOptions {
    ifNotExists?: boolean;
}

const LIVE = '("expiresAt" IS NULL OR "expiresAt" > now())';

const deadlineFromMs = (ttlMs: number | undefined): Date | null =>
    ttlMs === undefined ? null : new Date(Date.now() + ttlMs);

export class KeyValueStore {
    constructor(private readonly manager: EntityManager) {}

    async get(key: string): Promise<string | null> {
        const rows = await this.manager.query<{ value: string }[]>(
            `SELECT value FROM key_value_entries WHERE key = $1 AND ${LIVE}`,
            [key]
        );

        return rows[0]?.value ?? null;
    }

    async getMany(keys: string[]): Promise<(string | null)[]> {
        if (keys.length === 0) {
            return [];
        }

        const rows = await this.manager.query<{ key: string; value: string }[]>(
            `SELECT key, value FROM key_value_entries WHERE key = ANY($1) AND ${LIVE}`,
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
                     /* A bare increment leaves the deadline alone, as Redis INCR does. */
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
            `SELECT key FROM key_value_entries WHERE key = $1 AND ${LIVE}`,
            [key]
        );

        return rows.length > 0;
    }

    async expire(key: string, ttlMs: number): Promise<boolean> {
        const rows = await this.manager.query<{ key: string }[]>(
            `WITH refreshed AS (
                 UPDATE key_value_entries SET "expiresAt" = $2
                 WHERE key = $1 AND ${LIVE}
                 RETURNING key
             ) SELECT key FROM refreshed`,
            [key, deadlineFromMs(ttlMs)]
        );

        return rows.length > 0;
    }

    async delete(keys: string[]): Promise<number> {
        return (await this.deleteReturningPresent(keys)).length;
    }

    async deleteReturningPresent(keys: string[]): Promise<string[]> {
        if (keys.length === 0) {
            return [];
        }

        const rows = await this.manager.query<{ key: string }[]>(
            `WITH removed AS (
                 DELETE FROM key_value_entries WHERE key = ANY($1) AND ${LIVE} RETURNING key
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
            `SELECT member FROM key_value_set_members WHERE key = $1 AND ${LIVE}`,
            [key]
        );

        return rows.map((row) => row.member);
    }

    async setCount(key: string): Promise<number> {
        const rows = await this.manager.query<{ total: string }[]>(
            `SELECT count(*)::text AS total FROM key_value_set_members WHERE key = $1 AND ${LIVE}`,
            [key]
        );

        return Number(rows[0]?.total ?? 0);
    }

    async setExpire(key: string, ttlMs: number): Promise<void> {
        await this.manager.query(
            `UPDATE key_value_set_members SET "expiresAt" = $2 WHERE key = $1 AND ${LIVE}`,
            [key, deadlineFromMs(ttlMs)]
        );
    }

    async deleteSets(keys: string[]): Promise<void> {
        if (keys.length === 0) {
            return;
        }

        await this.manager.query('DELETE FROM key_value_set_members WHERE key = ANY($1)', [keys]);
    }

    async withLock<R>(name: string, work: (store: KeyValueStore) => Promise<R>): Promise<R> {
        return this.transaction(async (store) => {
            await store.manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [name]);
            return work(store);
        });
    }

    transaction<R>(work: (store: KeyValueStore) => Promise<R>): Promise<R> {
        if (this.manager.queryRunner?.isTransactionActive) {
            return work(this);
        }

        return this.manager.transaction((transactional) => work(new KeyValueStore(transactional)));
    }
}

export const getKeyValueStore = (): KeyValueStore =>
    new KeyValueStore(KeyValueEntry.getRepository().manager);

export const sweepExpiredKeyValues = async (): Promise<number> => {
    const manager = KeyValueEntry.getRepository().manager;
    const [entries, members] = await Promise.all([
        manager.query<{ key: string }[]>(
            'WITH swept AS (DELETE FROM key_value_entries WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= now() RETURNING key) SELECT key FROM swept'
        ),
        manager.query<{ key: string }[]>(
            'WITH swept AS (DELETE FROM key_value_set_members WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= now() RETURNING key) SELECT key FROM swept'
        )
    ]);

    return entries.length + members.length;
};
