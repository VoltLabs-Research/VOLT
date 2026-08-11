import KeyValueEntry from '@shared/infrastructure/persistence/models/KeyValueEntry';
import type { EntityManager } from 'typeorm';

/*
 * Mutations that report rows are wrapped in a CTE so the statement reads as a
 * SELECT.
 *
 * The driver returns a bare row array for SELECT and INSERT, but `[rows, count]`
 * for UPDATE and DELETE. Reading `rows[0]` off the second shape yields the row
 * array itself — truthy, and silently wrong. Wrapping makes every statement here
 * return the one shape.
 */

/** A deadline on its own, for the writes that cannot also be conditional. */
interface KeyValueTtlOptions {
    ttlMs?: number;
}

interface KeyValueWriteOptions extends KeyValueTtlOptions {
    /** Mirrors Redis `SET … NX`: the write lands only when no live entry holds the key. */
    ifNotExists?: boolean;
}

/**
 * Expiry is evaluated in SQL rather than in the process, so a lapsed entry is
 * invisible even to a caller whose clock has drifted from the database's.
 */
const LIVE = '("expiresAt" IS NULL OR "expiresAt" > now())';

const deadlineFromMs = (ttlMs: number | undefined): Date | null =>
    ttlMs === undefined ? null : new Date(Date.now() + ttlMs);

/**
 * The expiring key space the runtime job bookkeeping needs, on Postgres.
 *
 * Every mutation is a single statement whose conflict clause carries the
 * condition, rather than a read followed by a write. That is what replaces the
 * Lua scripts the Redis version used: `SET NX`, counter adjustment and
 * compare-and-delete are each atomic because Postgres evaluates them atomically,
 * not because we hold a lock around them.
 */
export class KeyValueStore {
    constructor(private readonly manager: EntityManager) {}

    async get(key: string): Promise<string | null> {
        const rows = await this.manager.query<{ value: string }[]>(
            `SELECT value FROM key_value_entries WHERE key = $1 AND ${LIVE}`,
            [key]
        );

        return rows[0]?.value ?? null;
    }

    /** Positionally aligned with `keys`, with `null` for whatever is absent or lapsed. */
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

    /** Resolves false only when `ifNotExists` was asked for and a live entry held the key. */
    async set(key: string, value: string, options: KeyValueWriteOptions = {}): Promise<boolean> {
        /*
         * An entry that is present but lapsed must not block an `ifNotExists`
         * write, so the conflict target updates it in place instead of the
         * statement failing. Deleting expired rows first would open exactly the
         * race this single statement exists to close.
         */
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

    /** Adds `delta` to a counter, treating a missing or lapsed entry as zero. */
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

    /** No-op when the key is absent or already lapsed, matching Redis EXPIRE. */
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

    /**
     * Deletes and reports which keys were actually live, which is how a caller
     * distinguishes "I removed this" from "someone else already did" without a
     * separate read.
     */
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

    /** Compare-and-delete: releases a lease only if the holder still owns it. */
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

    /** Refreshes a whole set's deadline, the set analogue of `expire`. */
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

    /**
     * Serializes `work` against everyone else holding the same name, for the rest
     * of the surrounding transaction.
     *
     * This is what replaces a Lua script. A read-then-decide-then-write sequence
     * cannot be made safe by a transaction alone at READ COMMITTED — two callers
     * both see a counter at 1 and both conclude they drained it — and row locks
     * do not help when the decision hinges on a row being absent. An advisory
     * lock is held on the name itself, so it serializes creation and deletion
     * alike.
     */
    async withLock<R>(name: string, work: (store: KeyValueStore) => Promise<R>): Promise<R> {
        return this.transaction(async (store) => {
            await store.manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [name]);
            return work(store);
        });
    }

    /**
     * Runs `work` against a transactional view of the store. Sequences that must
     * be seen whole — read a counter, decide, then clear several keys — use this;
     * anything expressible as one statement should not.
     */
    transaction<R>(work: (store: KeyValueStore) => Promise<R>): Promise<R> {
        if (this.manager.queryRunner?.isTransactionActive) {
            return work(this);
        }

        return this.manager.transaction((transactional) => work(new KeyValueStore(transactional)));
    }
}

/**
 * The store bound to the pooled connection.
 *
 * Deliberately **not** memoised, unlike the singletons around it. The store's only
 * state is the manager it wraps, so caching the instance would also cache that
 * manager — and a data source that is destroyed and rebuilt would leave every
 * caller holding a dead one. Reading it per call is a map lookup and one small
 * object, which is not worth trading for that failure mode.
 */
export const getKeyValueStore = (): KeyValueStore =>
    new KeyValueStore(KeyValueEntry.getRepository().manager);

/**
 * Reclaims lapsed rows. Reads already ignore them, so this is housekeeping and
 * safe to skip or run late; it exists so a long-lived deployment does not
 * accumulate dead receipts indefinitely.
 */
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
