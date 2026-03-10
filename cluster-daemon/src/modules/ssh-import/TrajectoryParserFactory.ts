import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export interface FrameMetadata {
    timestep: number;
    natoms: number;
    headers: string[];
    simulationCell: Record<string, unknown>;
};

class LammpsDumpParser {
    canParse(headerLines: string[]): boolean {
        return headerLines.some((line) => line.includes('ITEM: TIMESTEP'));
    }

    parseMetadataOnly(headerLines: string[]): FrameMetadata {
        let timestep = 0;
        let natoms = 0;
        let headers: string[] = [];
        const simulationCell: Record<string, unknown> = {
            boundingBox: {
                width: 0,
                height: 0,
                length: 0
            },
            geometry: {
                cell_vectors: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
                cell_origin: [0, 0, 0],
                periodic_boundary_conditions: {
                    x: false,
                    y: false,
                    z: false
                }
            }
        };

        for (let index = 0; index < headerLines.length; index += 1) {
            const line = headerLines[index].trim();
            if (line.includes('ITEM: TIMESTEP') && headerLines[index + 1]) {
                timestep = Number(headerLines[index + 1]);
            } else if (line.includes('ITEM: NUMBER OF ATOMS') && headerLines[index + 1]) {
                natoms = Number(headerLines[index + 1]);
            } else if (line.includes('ITEM: ATOMS')) {
                headers = line.replace('ITEM: ATOMS', '').trim().split(/\s+/);
                break;
            }
        }

        return {
            timestep,
            natoms,
            headers,
            simulationCell
        };
    }
};

class LammpsDataParser {
    canParse(headerLines: string[]): boolean {
        const content = headerLines.join('\n');
        const hasAtomsDef = /^\s*\d+\s+atoms/m.test(content);
        const hasBounds = /(xlo\s+xhi|ylo\s+yhi|zlo\s+zhi)/m.test(content);
        return hasAtomsDef && hasBounds;
    }

    parseMetadataOnly(headerLines: string[]): FrameMetadata {
        let timestep = 0;
        let natoms = 0;
        const headers: string[] = [];
        const simulationCell: Record<string, unknown> = {
            boundingBox: {
                width: 0,
                height: 0,
                length: 0
            },
            geometry: {
                cell_vectors: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
                cell_origin: [0, 0, 0],
                periodic_boundary_conditions: {
                    x: true,
                    y: true,
                    z: true
                }
            }
        };

        const content = headerLines.join('\n');
        const timestepMatch = content.match(/timestep\s*=\s*(\d+)/i);
        if (timestepMatch) {
            timestep = Number(timestepMatch[1]);
        }

        const atomsMatch = content.match(/^\s*(\d+)\s+atoms/m);
        if (atomsMatch) {
            natoms = Number(atomsMatch[1]);
        }

        return {
            timestep,
            natoms,
            headers,
            simulationCell
        };
    }
};

const peekFileHeader = async (filePath: string, maxLines = 200): Promise<string[]> => {
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
};

export class TrajectoryParserFactory {
    private static readonly dumpParser = new LammpsDumpParser();
    private static readonly dataParser = new LammpsDataParser();

    static async parseMetadata(filePath: string): Promise<FrameMetadata> {
        const headerLines = await peekFileHeader(filePath, 200);

        if (this.dumpParser.canParse(headerLines)) {
            return this.dumpParser.parseMetadataOnly(headerLines);
        }

        if (this.dataParser.canParse(headerLines)) {
            return this.dataParser.parseMetadataOnly(headerLines);
        }

        throw new Error('Unsupported trajectory format');
    }
};
