export const SQLITE_CHUNK_SIZE = 500;

export const placeholders = (count: number): string => Array.from({ length: count }, () => '?').join(', ');

export const chunked = <T>(items: readonly T[], size: number = SQLITE_CHUNK_SIZE): T[][] => {
    const chunks: T[][] = [];
    for (let offset = 0; offset < items.length; offset += size) {
        chunks.push(items.slice(offset, offset + size));
    }

    return chunks;
};
