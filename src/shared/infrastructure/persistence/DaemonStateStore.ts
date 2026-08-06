import { getDaemonDataSource } from '@shared/infrastructure/persistence/DataSource';
import { singleton } from '@shared/application/utilities/singleton';

/*
 * Mutations that report rows are wrapped in a CTE so the statement reads as a
 * SELECT.
 *
 * The driver returns a bare row array for SELECT and INSERT, but `[rows, count]`
 * for UPDATE and DELETE. Reading `rows[0]` off the second shape yields the row
 * array itself — truthy, and silently wrong. Wrapping makes every statement here
 * return the one shape.
 */

/** Expiry is evaluated in SQL so a lapsed entry is invisible regardless of clock drift. */
const LIVE = '("expiresAt" IS NULL OR "expiresAt" > now())';

const manager = () => getDaemonDataSource().manager;

const toDeadline = (ttlSeconds: number | undefined): Date | null =>
    ttlSeconds === undefined ? null : new Date(Date.now() + ttlSeconds * 1000);

/**
 * The daemon's expiring key space and its ordered lists.
 *
 * Method names and signatures are those of the Redis connection this replaced, so
 * the callers describe the same intent; what changed is that each operation is now
 * a single statement whose condition lives in its conflict clause, rather than a
 * read followed by a write.
 */
export class DaemonStateStore {
    /** Resolves false when a live entry already holds the key, as `SET NX` did. */
    async setKeyIfAbsent(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
        /*
         * An entry that is present but lapsed must not block the write, so the
         * conflict target updates it in place. Deleting expired rows first would
         * open exactly the race this single statement closes.
         */
        const rows = await manager().query<{ key: string }[]>(
            `INSERT INTO daemon_state_entries AS target (key, value, "expiresAt")
             VALUES ($1, $2, $3)
             ON CONFLICT (key) DO UPDATE
                 SET value = excluded.value, "expiresAt" = excluded."expiresAt"
                 WHERE target."expiresAt" IS NOT NULL AND target."expiresAt" <= now()
             RETURNING target.key`,
            [key, value, toDeadline(ttlSeconds)]
        );

        return rows.length > 0;
    }

    /** Treats a missing or lapsed entry as zero, so the first decrement yields -1. */
    async decrementKey(key: string): Promise<number> {
        const rows = await manager().query<{ value: string }[]>(
            `INSERT INTO daemon_state_entries AS target (key, value, "expiresAt")
             VALUES ($1, '-1', NULL)
             ON CONFLICT (key) DO UPDATE
                 SET value = ((CASE
                         WHEN target."expiresAt" IS NOT NULL AND target."expiresAt" <= now() THEN 0
                         ELSE target.value::bigint
                     END) - 1)::text
             RETURNING target.value`,
            [key]
        );

        return Number(rows[0]?.value ?? -1);
    }

    async deleteKey(key: string): Promise<number> {
        return this.deleteKeys([key]);
    }

    async deleteKeys(keys: string[]): Promise<number> {
        if (keys.length === 0) {
            return 0;
        }

        const rows = await manager().query<{ key: string }[]>(
            'WITH removed AS (DELETE FROM daemon_state_entries WHERE key = ANY($1) RETURNING key) SELECT key FROM removed',
            [keys]
        );

        /* Lists share the key space, so a delete clears both shapes. */
        await manager().query('DELETE FROM daemon_state_list_items WHERE key = ANY($1)', [keys]);

        return rows.length;
    }

    async getValue(key: string): Promise<string | null> {
        const rows = await manager().query<{ value: string }[]>(
            `SELECT value FROM daemon_state_entries WHERE key = $1 AND ${LIVE}`,
            [key]
        );

        return rows[0]?.value ?? null;
    }

    async setValueWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
        await manager().query(
            `INSERT INTO daemon_state_entries (key, value, "expiresAt")
             VALUES ($1, $2, $3)
             ON CONFLICT (key) DO UPDATE
                 SET value = excluded.value, "expiresAt" = excluded."expiresAt"`,
            [key, value, toDeadline(ttlSeconds)]
        );
    }

    /**
     * Replaces a list with `values`, preserving their order.
     *
     * Replacement rather than append: the caller rebuilds the whole admission
     * order each time, and the clear and the write share a transaction so a
     * concurrent reader never sees a half-written list.
     */
    async appendListWithTtl(key: string, values: string[], ttlSeconds: number): Promise<void> {
        await manager().transaction(async (transactional) => {
            await transactional.query('DELETE FROM daemon_state_list_items WHERE key = $1', [key]);

            if (values.length === 0) {
                return;
            }

            await transactional.query(
                `INSERT INTO daemon_state_list_items (key, position, value, "expiresAt")
                 SELECT $1, source.position - 1, source.value, $3
                 FROM unnest($2::text[]) WITH ORDINALITY AS source(value, position)`,
                [key, values, toDeadline(ttlSeconds)]
            );
        });
    }

    /**
     * Removes and returns the head of the list.
     *
     * `SKIP LOCKED` means two workers popping at once each take a different
     * element instead of one waiting for the other, and neither can observe the
     * same element as the other's.
     */
    async popListHead(key: string): Promise<string | null> {
        const rows = await manager().query<{ value: string }[]>(
            `WITH popped AS (
                 DELETE FROM daemon_state_list_items
                 WHERE id = (
                     SELECT id FROM daemon_state_list_items
                     WHERE key = $1 AND ${LIVE}
                     ORDER BY position
                     FOR UPDATE SKIP LOCKED
                     LIMIT 1
                 )
                 RETURNING value
             ) SELECT value FROM popped`,
            [key]
        );

        return rows[0]?.value ?? null;
    }
}

export const getDaemonStateStore = singleton((): DaemonStateStore => new DaemonStateStore());

/** Reclaims lapsed rows; reads already ignore them, so this is housekeeping. */
export const sweepExpiredDaemonState = async (): Promise<number> => {
    const [entries, items] = await Promise.all([
        manager().query<{ key: string }[]>(
            'WITH swept AS (DELETE FROM daemon_state_entries WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= now() RETURNING key) SELECT key FROM swept'
        ),
        manager().query<{ key: string }[]>(
            'WITH swept AS (DELETE FROM daemon_state_list_items WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= now() RETURNING key) SELECT key FROM swept'
        )
    ]);

    return entries.length + items.length;
};
