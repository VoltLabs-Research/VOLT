import path from 'path';
import { ParseResult, FrameMetadata, ParseOptions } from '@/types/parser';
import { getStatsNative } from './native-stats';

interface NativeDumpResult {
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    properties?: { [name: string]: Float32Array };
    metadata: {
        timestep: number;
        natoms: number;
        boxBounds: {
            xlo: number;
            xhi: number;
            ylo: number;
            yhi: number;
            zlo: number;
            zhi: number;
        };
        headers: string[];
    };
    min: [number, number, number];
    max: [number, number, number];
}

interface NativeModule {
    parseDump(filePath: string, options: { includeIds?: boolean; properties?: string[] }): NativeDumpResult | undefined;
}

const nativePath = path.join(process.cwd(), 'native/build/Release/dump_parser.node');
const nativeModule: NativeModule = require(nativePath);

/**
 * High-performance LAMMPS dump parser using native C++ addon.
 * Uses mmap + fast_atof for maximum parsing speed.
 */
export default class LammpsDumpParser {
    /**
     * Parse a LAMMPS dump file using the native C++ parser.
     */
    public parse(filePath: string, options: ParseOptions = {}): ParseResult {
        const result = nativeModule.parseDump(filePath, {
            includeIds: options.includeIds,
            properties: options.properties
        });

        if (!result) {
            throw new Error('NativeDumpParserFailed');
        }

        return {
            metadata: result.metadata as FrameMetadata,
            positions: result.positions,
            types: result.types,
            ids: result.ids,
            properties: result.properties,
            min: result.min,
            max: result.max
        };
    }

    /**
     * Get min/max statistics for a property using native C++ parser.
     */
    public getStatsForProperty(filePath: string, property: string): { min: number; max: number } {
        // First parse header to find property index
        const result = nativeModule.parseDump(filePath, { properties: [] });
        if (!result) {
            throw new Error('NativeDumpParserFailed');
        }

        const propIdx = result.metadata.headers.findIndex(
            (h: string) => h === property.toLowerCase()
        );

        if (propIdx === -1) {
            throw new Error(`Property ${property} not found in dump file headers.`);
        }

        const stats = getStatsNative(filePath, propIdx);
        if (!stats) {
            throw new Error('Native stats parser failed');
        }
        return stats;
    }

    /**
     * Check if file is a valid LAMMPS dump format.
     */
    public canParse(headerLines: string[]): boolean {
        return headerLines.some((line) => line.includes('ITEM: TIMESTEP'));
    }

    /**
     * Parse only metadata from header lines (Pure JS, no C++ overhead).
     */
    public parseMetadataOnly(headerLines: string[]): FrameMetadata {
        let timestep = 0;
        let natoms = 0;
        let boxBounds = { xlo: 0, xhi: 0, ylo: 0, yhi: 0, zlo: 0, zhi: 0 };
        let headers: string[] = [];

        for (let i = 0; i < headerLines.length; i++) {
            const line = headerLines[i].trim();
            if (line.includes('ITEM: TIMESTEP') && headerLines[i + 1]) {
                timestep = Number(headerLines[i + 1]);
            } else if (line.includes('ITEM: NUMBER OF ATOMS') && headerLines[i + 1]) {
                natoms = Number(headerLines[i + 1]);
            } else if (line.includes('ITEM: BOX BOUNDS') && headerLines[i + 3]) {
                const x = headerLines[i + 1].trim().split(/\s+/).map(Number);
                const y = headerLines[i + 2].trim().split(/\s+/).map(Number);
                const z = headerLines[i + 3].trim().split(/\s+/).map(Number);
                boxBounds = { xlo: x[0], xhi: x[1], ylo: y[0], yhi: y[1], zlo: z[0], zhi: z[1] };
            } else if (line.includes('ITEM: ATOMS')) {
                // Format: ITEM: ATOMS id type x y z ...
                headers = line.replace('ITEM: ATOMS', '').trim().split(/\s+/);
                break;
            }
        }
        return { timestep, natoms, boxBounds, headers };
    }
}
