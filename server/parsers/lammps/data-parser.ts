import path from 'path';
import { ParseResult, FrameMetadata, ParseOptions } from '@/types/parser';

interface NativeDataResult {
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    metadata: {
        timestep: number;
        natoms: number;
        headers: string[];
    };
    min: [number, number, number];
    max: [number, number, number];
}

interface NativeModule {
    parseData(filePath: string, options: { includeIds?: boolean }): NativeDataResult | undefined;
}

const nativePath = path.join(process.cwd(), 'native/build/Release/data_parser.node');
const nativeModule: NativeModule = require(nativePath);

/**
 * High-performance LAMMPS data parser using native C++ addon.
 * Uses mmap + fast_atof for maximum parsing speed.
 */
export default class LammpsDataParser {
    /**
     * Parse a LAMMPS data file using the native C++ parser.
     */
    public parse(filePath: string, options: ParseOptions = {}): ParseResult {
        const result = nativeModule.parseData(filePath, {
            includeIds: options.includeIds
        });

        if (!result) {
            throw new Error('NativeDataParserFailed');
        }

        return {
            metadata: result.metadata as FrameMetadata,
            positions: result.positions,
            types: result.types,
            ids: result.ids,
            min: result.min,
            max: result.max
        };
    }

    /**
     * Check if file is a valid LAMMPS data format.
     */
    public canParse(headerLines: string[]): boolean {
        const content = headerLines.join('\n');
        const hasAtomsDef = /^\s*\d+\s+atoms/m.test(content);
        const hasBounds = /xlo\s+xhi/m.test(content);
        return hasAtomsDef && hasBounds;
    }
}
