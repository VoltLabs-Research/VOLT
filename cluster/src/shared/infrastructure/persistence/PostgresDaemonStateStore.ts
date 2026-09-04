import { getDaemonDataSource } from '@shared/infrastructure/persistence/DataSource';
import { deadlineFromSeconds } from '@shared/infrastructure/persistence/daemon-state-store-contract';
import type { DaemonStateStore } from '@shared/infrastructure/persistence/daemon-state-store-contract';

const LIVE = '("expiresAt" IS NULL OR "expiresAt" > now())';

const manager = () => getDaemonDataSource().manager;

export class PostgresDaemonStateStore implements DaemonStateStore {
    async setKeyIfAbsent(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
        const rows = await manager().query<{ key: string }[]>(
            `INSERT INTO daemon_state_entries AS target (key, value, "expiresAt")
             VALUES ($1, $2, $3)
             ON CONFLICT (key) DO UPDATE
                 SET value = excluded.value, "expiresAt" = excluded."expiresAt"
                 WHERE target."expiresAt" IS NOT NULL AND target."expiresAt" <= now()
             RETURNING target.key`,
            [key, value, deadlineFromSeconds(ttlSeconds)]
        );

        return rows.length > 0;
    }

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

    deleteKey(key: string): Promise<number> {
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
            [key, value, deadlineFromSeconds(ttlSeconds)]
        );
    }

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
                [key, values, deadlineFromSeconds(ttlSeconds)]
            );
        });
    }

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

    async sweepExpired(): Promise<number> {
        const [entries, items] = await Promise.all([
            manager().query<{ key: string }[]>(
                'WITH swept AS (DELETE FROM daemon_state_entries WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= now() RETURNING key) SELECT key FROM swept'
            ),
            manager().query<{ key: string }[]>(
                'WITH swept AS (DELETE FROM daemon_state_list_items WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= now() RETURNING key) SELECT key FROM swept'
            )
        ]);

        return entries.length + items.length;
    }
}
