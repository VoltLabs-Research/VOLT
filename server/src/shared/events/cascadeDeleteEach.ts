import logger from '@shared/infrastructure/logger';

interface CascadeDeleteEachOptions {
    /** Identifies the caller in the warning emitted when one child fails. */
    label: string;
    ids: readonly string[];
    deleteOne: (id: string) => Promise<void>;
    concurrency?: number;
}

const DEFAULT_CONCURRENCY = 8;

/**
 * Deletes children one by one with bounded concurrency, isolating failures so a
 * single bad child cannot abort the rest of the cascade.
 */
export const cascadeDeleteEach = async ({
    label,
    ids,
    deleteOne,
    concurrency = DEFAULT_CONCURRENCY
}: CascadeDeleteEachOptions): Promise<void> => {
    if (ids.length === 0) {
        return;
    }

    let cursor = 0;

    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
        while (cursor < ids.length) {
            const id = ids[cursor++];

            try {
                await deleteOne(id);
            } catch (error) {
                logger.warn({
                    err: error,
                    handler: label,
                    id
                }, `@cascade-delete: failed to delete child ${id}`);
            }
        }
    });

    await Promise.all(workers);
};
