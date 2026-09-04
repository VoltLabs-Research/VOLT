import { getDaemonDataSource } from '@shared/infrastructure/persistence/DataSource';
import { deadlineFromSeconds } from '@shared/infrastructure/persistence/daemon-state-store-contract';
import { sqliteNow, toSqliteDateTime } from '@shared/infrastructure/persistence/sqlite-time';
import type { DaemonStateStore } from '@shared/infrastructure/persistence/daemon-state-store-contract';
import type { EntityManager } from 'typeorm';

const LIVE = '("expiresAt" IS NULL OR "expiresAt" > ?)';
const KEY_CHUNK_SIZE = 500;
const LIST_INSERT_CHUNK_SIZE = 500;

const manager = () => getDaemonDataSource().manager;

const deadlineText = (ttlSeconds: number | undefined): string | null => {
    const deadline = deadlineFromSeconds(ttlSeconds);
    return deadline ? toSqliteDateTime(deadline) : null;
};

const placeholders = (count: number): string => Array.from({ length: count }, () => '?').join(', ');

const chunked = <T>(items: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let offset = 0; offset < items.length; offset += size) {
        chunks.push(items.slice(offset, offset + size));
    }

    return chunks;
};

export class SqliteDaemonStateStore implements DaemonStateStore {
    async setKeyIfAbsent(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
        const rows = await manager().query<{ key: string }[]>(
            `INSERT INTO daemon_state_entries (key, value, "expiresAt")
             VALUES (?, ?, ?)
             ON CONFLICT (key) DO UPDATE
                 SET value = excluded.value, "expiresAt" = excluded."expiresAt"
                 WHERE daemon_state_entries."expiresAt" IS NOT NULL AND daemon_state_entries."expiresAt" <= ?
             RETURNING key`,
            [key, value, deadlineText(ttlSeconds), sqliteNow()]
        );

        return rows.length > 0;
    }

    async decrementKey(key: string): Promise<number> {
        const rows = await manager().query<{ value: string }[]>(
            `INSERT INTO daemon_state_entries (key, value, "expiresAt")
             VALUES (?, '-1', NULL)
             ON CONFLICT (key) DO UPDATE
                 SET value = CAST(((CASE
                         WHEN daemon_state_entries."expiresAt" IS NOT NULL AND daemon_state_entries."expiresAt" <= ? THEN 0
                         ELSE CAST(daemon_state_entries.value AS INTEGER)
                     END) - 1) AS TEXT)
             RETURNING value`,
            [key, sqliteNow()]
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

        let removed = 0;
        for (const chunk of chunked(keys, KEY_CHUNK_SIZE)) {
            const rows = await manager().query<{ key: string }[]>(
                `DELETE FROM daemon_state_entries WHERE key IN (${placeholders(chunk.length)}) RETURNING key`,
                chunk
            );
            await manager().query(
                `DELETE FROM daemon_state_list_items WHERE key IN (${placeholders(chunk.length)})`,
                chunk
            );
            removed += rows.length;
        }

        return removed;
    }

    async getValue(key: string): Promise<string | null> {
        const rows = await manager().query<{ value: string }[]>(
            `SELECT value FROM daemon_state_entries WHERE key = ? AND ${LIVE}`,
            [key, sqliteNow()]
        );

        return rows[0]?.value ?? null;
    }

    async setValueWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
        await manager().query(
            `INSERT INTO daemon_state_entries (key, value, "expiresAt")
             VALUES (?, ?, ?)
             ON CONFLICT (key) DO UPDATE
                 SET value = excluded.value, "expiresAt" = excluded."expiresAt"`,
            [key, value, deadlineText(ttlSeconds)]
        );
    }

    async appendListWithTtl(key: string, values: string[], ttlSeconds: number): Promise<void> {
        await manager().transaction(async (transactional: EntityManager) => {
            await transactional.query('DELETE FROM daemon_state_list_items WHERE key = ?', [key]);

            if (values.length === 0) {
                return;
            }

            const expiresAt = deadlineText(ttlSeconds);
            let position = 0;
            for (const chunk of chunked(values, LIST_INSERT_CHUNK_SIZE)) {
                await transactional.query(
                    `INSERT INTO daemon_state_list_items (key, position, value, "expiresAt")
                     VALUES ${chunk.map(() => '(?, ?, ?, ?)').join(', ')}`,
                    chunk.flatMap((value) => [key, position++, value, expiresAt])
                );
            }
        });
    }

    async popListHead(key: string): Promise<string | null> {
        const rows = await manager().query<{ value: string }[]>(
            `DELETE FROM daemon_state_list_items
             WHERE id = (
                 SELECT id FROM daemon_state_list_items
                 WHERE key = ? AND ${LIVE}
                 ORDER BY position
                 LIMIT 1
             )
             RETURNING value`,
            [key, sqliteNow()]
        );

        return rows[0]?.value ?? null;
    }

    async sweepExpired(): Promise<number> {
        const now = sqliteNow();
        const entries = await manager().query<{ key: string }[]>(
            'DELETE FROM daemon_state_entries WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= ? RETURNING key',
            [now]
        );
        const items = await manager().query<{ key: string }[]>(
            'DELETE FROM daemon_state_list_items WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= ? RETURNING key',
            [now]
        );

        return entries.length + items.length;
    }
}
