import { decodeMultiStream, mergeSelectiveChunk } from '@/shared/utilities/selective-msgpack';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import type { Readable } from 'node:stream';

interface DebugExposureInspectionResult {
    outputFilePath: string;
    listingRowCount: number;
    subListingNames: string[];
    exportPayload: Record<string, unknown> | null;
}

const LISTING_KEYS = new Set(['main_listing']);
const EXPORT_KEY_PREFIX = 'export';

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readPayload = async (filePath: string): Promise<{
    listing: Record<string, unknown> | null;
    subListingNames: string[];
    exportData: Record<string, unknown> | null;
}> => {
    const stream = createReadStream(filePath) as unknown as Readable;
    const asyncIterable = (async function* () {
        for await (const chunk of stream) {
            yield chunk as Uint8Array | Buffer;
        }
    })();

    let listing: Record<string, unknown> | null = null;
    let exportData: Record<string, unknown> | null = null;
    const subListingNames = new Set<string>();

    for await (const message of decodeMultiStream(asyncIterable)) {
        listing = mergeSelectiveChunk(listing, message, (key) => LISTING_KEYS.has(key));
        exportData = mergeSelectiveChunk(exportData, message, (key) => key === EXPORT_KEY_PREFIX || key.startsWith(`${EXPORT_KEY_PREFIX}.`));

        if (!isRecord(message) || !isRecord(message.sub_listings)) {
            continue;
        }

        for (const [name, value] of Object.entries(message.sub_listings)) {
            if (Array.isArray(value) && value.length > 0) {
                if (value.some(isRecord)) {
                    subListingNames.add(name);
                }
                continue;
            }

            if (isRecord(value) && Object.keys(value).length > 0) {
                subListingNames.add(name);
            }
        }
    }

    return {
        listing,
        subListingNames: Array.from(subListingNames),
        exportData
    };
};

const countListingRows = (listing: Record<string, unknown> | null): number => {
    const mainListing = listing?.main_listing;
    return Array.isArray(mainListing) ? mainListing.length : 0;
};

export const inspectDebugExposureResult = async (
    outputDir: string,
    resultsFileName: string
): Promise<DebugExposureInspectionResult> => {
    const outputFilePath = `${outputDir}_${resultsFileName}`;
    await fs.access(outputFilePath);

    const {
        listing,
        subListingNames,
        exportData
    } = await readPayload(outputFilePath);

    return {
        outputFilePath,
        listingRowCount: countListingRows(listing),
        subListingNames,
        exportPayload: exportData
    };
};

export type { DebugExposureInspectionResult };
