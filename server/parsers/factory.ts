import LammpsDumpParser from '@/parsers/lammps/dump-parser';
import LammpsDataParser from '@/parsers/lammps/data-parser';
import { readLargeFile } from '@/utilities/fs';
import { ParseOptions, ParseResult } from '@/types/parser';

/**
 * Factory for parsing trajectory files using native C++ parsers.
 */
export default class TrajectoryParserFactory {
    /**
     * Automatically detects the file format and parses using native C++ addon.
     */
    public static async parse(filePath: string, options?: ParseOptions): Promise<ParseResult> {
        // Peek at header to detect format
        const headerLines: string[] = [];
        await readLargeFile(filePath, {
            maxLines: 50,
            onLine: (line) => headerLines.push(line)
        });

        // Select parser based on format
        const dumpParser = new LammpsDumpParser();
        const dataParser = new LammpsDataParser();

        if (dumpParser.canParse(headerLines)) {
            return dumpParser.parse(filePath, options);
        } else if (dataParser.canParse(headerLines)) {
            return dataParser.parse(filePath, options);
        } else {
            throw new Error('UnsupportedTrajectoryFormat');
        }
    }
}
