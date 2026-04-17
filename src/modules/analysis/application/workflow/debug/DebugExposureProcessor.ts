import { decodeMultiStream, mergeSelectiveChunk } from '@/support/serialization/selective-msgpack';
import { isRecord } from '@/support/type-guards/isRecord';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';

type MsgpackScalar = string | number | boolean | null;
type MsgpackValue = MsgpackScalar | MsgpackObject | MsgpackValue[];

interface MsgpackObject {
    [key: string]: MsgpackValue | undefined;
}

type ListingRows = MsgpackValue[];
type SubListingValue = MsgpackObject | MsgpackObject[];

interface ListingPayload extends MsgpackObject {
    main_listing?: ListingRows;
}

interface SubListingCollection {
    [key: string]: SubListingValue | undefined;
}

interface DebugExposureMessage extends MsgpackObject {
    sub_listings?: SubListingCollection;
}

interface DebugExposurePayload {
    listing: ListingPayload | null;
    subListingNames: string[];
    exportData: MsgpackObject | null;
}

export interface DebugExposureInspectionResult {
    outputFilePath: string;
    listingRowCount: number;
    subListingNames: string[];
    exportPayload: MsgpackObject | null;
}

const LISTING_KEYS = new Set(['main_listing']);
const EXPORT_KEY_PREFIX = 'export';

const readPayload = async (filePath: string): Promise<DebugExposurePayload> => {
    let listing: ListingPayload | null = null;
    let exportData: MsgpackObject | null = null;
    const subListingNames = new Set<string>();

    for await (const message of decodeMultiStream(createReadStream(filePath))) {
        listing = mergeSelectiveChunk(listing, message, (key) => LISTING_KEYS.has(key)) as ListingPayload | null;
        exportData = mergeSelectiveChunk(exportData, message, (key) => key === EXPORT_KEY_PREFIX || key.startsWith(`${EXPORT_KEY_PREFIX}.`)) as MsgpackObject | null;

        if (!isRecord(message) || !isRecord(message.sub_listings)) {
            continue;
        }

        const debugMessage = message as DebugExposureMessage;
        const subListings = debugMessage.sub_listings as SubListingCollection;

        for (const [name, subListingValue] of Object.entries(subListings)) {
            if (subListingValue instanceof Array) {
                if (subListingValue.length > 0) {
                    subListingNames.add(name);
                }

                continue;
            }

            if (subListingValue !== undefined && Object.keys(subListingValue).length > 0) {
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
        listingRowCount: listing?.main_listing?.length ?? 0,
        subListingNames,
        exportPayload: exportData
    };
};
