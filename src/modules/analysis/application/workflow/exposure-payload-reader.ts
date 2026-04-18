import { decodeMultiStream, mergeSelectiveChunk } from '@/support/serialization/selective-msgpack';
import type { MsgpackObject, MsgpackValue } from '@/support/serialization/msgpack-value';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';

const isPlainObject = (value: MsgpackValue): value is MsgpackObject => {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Uint8Array);
};

export type WorkflowExposurePayloadValue = MsgpackObject;

export interface WorkflowExposurePayloadReadResult {
    listing: WorkflowExposurePayloadValue | null;
    subListingNames: string[];
    exportData: WorkflowExposurePayloadValue | null;
}

export interface WorkflowExposureInspectionResult {
    outputFilePath: string;
    listingRowCount: number;
    subListingNames: string[];
    exportPayload: WorkflowExposurePayloadValue | null;
}

const LISTING_KEYS = new Set(['main_listing']);
const EXPORT_KEY_PREFIX = 'export';

export const createWorkflowExposureOutputFilePath = (
    outputDir: string,
    resultsFileName: string
): string => {
    return `${outputDir}_${resultsFileName}`;
};

export const readWorkflowExposurePayload = async (
    filePath: string
): Promise<WorkflowExposurePayloadReadResult> => {
    let listing: WorkflowExposurePayloadValue | null = null;
    let exportData: WorkflowExposurePayloadValue | null = null;
    const subListingNames = new Set<string>();

    for await (const message of decodeMultiStream(createReadStream(filePath))) {
        listing = mergeSelectiveChunk(listing, message, (key) => LISTING_KEYS.has(key));
        exportData = mergeSelectiveChunk(exportData, message, (key) => {
            return key === EXPORT_KEY_PREFIX || key.startsWith(`${EXPORT_KEY_PREFIX}.`);
        });

        if (!isPlainObject(message)) {
            continue;
        }

        const subListings = message.sub_listings;
        if (!subListings || !isPlainObject(subListings)) {
            continue;
        }

        for (const [name, value] of Object.entries(subListings)) {
            if (Array.isArray(value) && value.length > 0) {
                if (value.some(isPlainObject)) {
                    subListingNames.add(name);
                }
                continue;
            }

            if (value && isPlainObject(value) && Object.keys(value).length > 0) {
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

export const inspectWorkflowExposureOutput = async (
    outputDir: string,
    resultsFileName: string
): Promise<WorkflowExposureInspectionResult> => {
    const outputFilePath = createWorkflowExposureOutputFilePath(outputDir, resultsFileName);
    await fs.access(outputFilePath);

    const {
        listing,
        subListingNames,
        exportData
    } = await readWorkflowExposurePayload(outputFilePath);
    const mainListing = listing?.main_listing;

    return {
        outputFilePath,
        listingRowCount: Array.isArray(mainListing) ? mainListing.length : 0,
        subListingNames,
        exportPayload: exportData
    };
};
