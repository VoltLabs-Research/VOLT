import LammpsDumpParser from './LammpsDumpParser';
import LammpsDataParser from './LammpsDataParser';
import { ParseResult, FrameMetadata, ParseOptions } from '@modules/trajectory/domain/port/ParserTypes';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

async function peekFileHeader(filePath: string, maxLines: number = 200): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const lines: string[] = [];
        const stream = createReadStream(filePath, {
            encoding: 'utf8',
            highWaterMark: 8 * 1024
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

export default class TrajectoryParserFactory {
    private static dumpParser = new LammpsDumpParser();
    private static dataParser = new LammpsDataParser();

    public static async parse(filePath: string, options?: ParseOptions): Promise<ParseResult> {
        const headerLines = await peekFileHeader(filePath, 200);

        if (this.dumpParser.canParse(headerLines)) {
            return this.dumpParser.parse(filePath, options);
        } else if (this.dataParser.canParse(headerLines)) {
            return this.dataParser.parse(filePath, options);
        } else {
            throw new Error('UnsupportedTrajectoryFormat');
        }
    }

    public static async parseMetadata(filePath: string): Promise<FrameMetadata> {
        const headerLines = await peekFileHeader(filePath, 200);

        if (this.dumpParser.canParse(headerLines)) {
            return this.dumpParser.parseMetadataOnly(headerLines);
        } else {
            const result = await this.parse(filePath);
            return result.metadata;
        }
    }
};