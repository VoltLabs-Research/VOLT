import { ErrorCodes } from '@core/constants/error-codes';
import { FrameMetadata } from '@modules/trajectory/domain/contracts/trajectory';
import LammpsDataParser from './LammpsDataParser';
import LammpsDumpParser from './LammpsDumpParser';
import ApplicationError from '@shared/application/errors/ApplicationError';

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

    public static async parseMetadata(filePath: string): Promise<FrameMetadata> {
        const headerLines = await peekFileHeader(filePath, 200);

        if (this.dumpParser.canParse(headerLines)) {
            return this.dumpParser.parseMetadataOnly(headerLines);
        }

        if (this.dataParser.canParse(headerLines)) {
            return this.dataParser.parseMetadataOnly(headerLines);
        }

        throw ApplicationError.badRequest(
            ErrorCodes.TRAJECTORY_FORMAT_UNSUPPORTED,
            'Unsupported trajectory format'
        );
    }
}
