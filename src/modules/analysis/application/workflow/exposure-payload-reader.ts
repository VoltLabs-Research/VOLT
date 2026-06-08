import { Unpackr } from 'msgpackr';
import mergeChunkedValue from '@/core/reverse-channel/application/merge-chunked-value';
import type { PerAtomProperties } from '@/modules/plugin/application/properties/PluginAtomProperties';
import type { MsgpackObject } from '@/support/serialization/msgpack-value';
import { isRecord } from '@/support/type-guards/is-record';
import { readFile } from 'node:fs/promises';

export interface WorkflowExposurePayloadReadResult {
    listing: MsgpackObject | null;
    subListingNames: string[];
    subListings: Record<string, MsgpackObject[]>;
    perAtomProperties: PerAtomProperties | null;
    exportData: MsgpackObject | null;
}

export interface WorkflowExposureInspectionResult {
    outputFilePath: string;
    listingRowCount: number;
    subListingNames: string[];
    exportPayload: MsgpackObject | null;
}

const LISTING_KEYS = new Set(['main_listing']);
const EXPORT_KEY_PREFIX = 'export';
const PER_ATOM_KEY = 'per-atom-properties';
const unpacker = new Unpackr({ mapsAsObjects: true });

export const createWorkflowExposureOutputFilePath = (
    outputDir: string,
    resultsFileName: string
): string => {
    return `${outputDir}_${resultsFileName}`;
};

const mergeSelectedKeys = (
    target: MsgpackObject | null,
    incoming: unknown,
    keyFilter: (key: string) => boolean
): MsgpackObject | null => {
    if (!isRecord(incoming)) {
        return target;
    }

    const filtered: MsgpackObject = {};
    for (const [key, incomingValue] of Object.entries(incoming)) {
        if (keyFilter(key)) {
            filtered[key] = incomingValue as MsgpackObject[string];
        }
    }

    if (Object.keys(filtered).length === 0) {
        return target;
    }

    const merged = mergeChunkedValue(target, filtered);
    return isRecord(merged) ? (merged as MsgpackObject) : target;
};

export const readWorkflowExposurePayload = async (
    filePath: string
): Promise<WorkflowExposurePayloadReadResult> => {
    let listing: MsgpackObject | null = null;
    let exportData: MsgpackObject | null = null;
    let perAtomPayload: MsgpackObject | null = null;
    const subListingNames = new Set<string>();
    const subListingRows = new Map<string, MsgpackObject[]>();
    const subListingObjectRows = new Map<string, MsgpackObject | null>();

    const buffer = await readFile(filePath);
    unpacker.unpackMultiple(buffer, (message: unknown) => {
        listing = mergeSelectedKeys(listing, message, (key) => LISTING_KEYS.has(key));
        perAtomPayload = mergeSelectedKeys(perAtomPayload, message, (key) => key === PER_ATOM_KEY);
        exportData = mergeSelectedKeys(exportData, message, (key) => {
            return key === EXPORT_KEY_PREFIX || key.startsWith(`${EXPORT_KEY_PREFIX}.`);
        });

        if (!isRecord(message)) {
            return;
        }

        const subListings = message.sub_listings;
        if (!subListings || !isRecord(subListings)) {
            return;
        }

        for (const [name, value] of Object.entries(subListings)) {
            if (Array.isArray(value) && value.length > 0) {
                const rows = value.filter(isRecord) as MsgpackObject[];
                if (rows.length > 0) {
                    subListingNames.add(name);
                    subListingRows.set(name, [
                        ...(subListingRows.get(name) ?? []),
                        ...rows
                    ]);
                }
                continue;
            }

            if (value && isRecord(value) && Object.keys(value).length > 0) {
                subListingNames.add(name);
                const merged = mergeChunkedValue(
                    subListingObjectRows.get(name) as unknown as Parameters<typeof mergeChunkedValue>[0],
                    value as unknown as Parameters<typeof mergeChunkedValue>[1]
                );
                subListingObjectRows.set(name, isRecord(merged) ? (merged as MsgpackObject) : null);
            }
        }
    });

    for (const [name, row] of subListingObjectRows.entries()) {
        if (!row) continue;
        subListingRows.set(name, [
            ...(subListingRows.get(name) ?? []),
            row
        ]);
    }

    return {
        listing,
        subListingNames: Array.from(subListingNames),
        subListings: Object.fromEntries(subListingRows),
        perAtomProperties: (perAtomPayload?.[PER_ATOM_KEY] as PerAtomProperties | null | undefined) ?? null,
        exportData
    };
};

export const inspectWorkflowExposureOutput = async (
    outputDir: string,
    resultsFileName: string
): Promise<WorkflowExposureInspectionResult> => {
    const outputFilePath = createWorkflowExposureOutputFilePath(outputDir, resultsFileName);

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
