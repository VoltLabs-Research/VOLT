import LammpsDumpParser from '@/parsers/lammps/dump-parser';
import LammpsDataParser from '@/parsers/lammps/data-parser';
import { ParseOptions, ParseResult } from '@/types/parser';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

/**
 * Read only the first few lines of a file for format detection.
 * Stops reading immediately after collecting enough lines.
 */
async function peekFileHeader(filePath: string, maxLines: number = 50): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const lines: string[] = [];
        const stream = createReadStream(filePath, {
            encoding: 'utf8',
            highWaterMark: 8 * 1024 // Small buffer for header only
        });

        const rl = createInterface({
            input: stream,
            crlfDelay: Infinity
        });

        rl.on('line', (line) => {
            lines.push(line);
            if (lines.length >= maxLines) {
                rl.close();
                stream.destroy();
            }
        });

        rl.on('close', () => resolve(lines));
        rl.on('error', reject);
        stream.on('error', reject);
    });
}

/**
 * Factory for parsing trajectory files using native C++ parsers.
 * Optimized for 100M+ atoms - no full file loading for format detection.
 */
export default class TrajectoryParserFactory {
    private static dumpParser = new LammpsDumpParser();
    private static dataParser = new LammpsDataParser();

    /**
     * Automatically detects the file format and parses using native C++ addon.
     */
    public static async parse(filePath: string, options?: ParseOptions): Promise<ParseResult> {
        // Peek only first 50 lines for format detection (fast, no memory issues)
        const headerLines = await peekFileHeader(filePath, 50);

        // Select parser based on format
        if (this.dumpParser.canParse(headerLines)) {
            return this.dumpParser.parse(filePath, options);
        } else if (this.dataParser.canParse(headerLines)) {
            return this.dataParser.parse(filePath, options);
        } else {
            throw new Error('UnsupportedTrajectoryFormat');
        }
    }
}
