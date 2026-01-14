import path from 'path';
import { ParseResult, FrameMetadata, ParseOptions } from '../../domain/port/ParserTypes';
import * as fs from 'fs';

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

export default class LammpsDataParser {
    public parse(filePath: string, options: ParseOptions = {}): ParseResult {
        const result = nativeModule.parseData(filePath, {
            includeIds: options.includeIds
        });

        if (!result) {
            throw new Error('NativeDataParserFailed');
        }

        let metadataWithCell = result.metadata as FrameMetadata;

        try {
            const fd = fs.openSync(filePath, 'r');
            const buffer = Buffer.alloc(1024);
            fs.readSync(fd, buffer, 0, 1024, 0);
            fs.closeSync(fd);

            const headerContent = buffer.toString('utf-8');
            const headerLines = headerContent.split('\n');
            const metaOnly = this.parseMetadataOnly(headerLines);

            if (metaOnly && metaOnly.simulationCell) {
                metadataWithCell.simulationCell = metaOnly.simulationCell;
            } else {
                const width = result.max[0] - result.min[0];
                const height = result.max[1] - result.min[1];
                const length = result.max[2] - result.min[2];
                metadataWithCell.simulationCell = {
                    boundingBox: { width, height, length },
                    geometry: {
                        cell_vectors: [[width, 0, 0], [0, height, 0], [0, 0, length]],
                        cell_origin: result.min,
                        periodic_boundary_conditions: { x: true, y: true, z: true }
                    }
                };
            }
        } catch (e) {
            const width = result.max[0] - result.min[0];
            const height = result.max[1] - result.min[1];
            const length = result.max[2] - result.min[2];
            metadataWithCell.simulationCell = {
                boundingBox: { width, height, length },
                geometry: {
                    cell_vectors: [[width, 0, 0], [0, height, 0], [0, 0, length]],
                    cell_origin: result.min,
                    periodic_boundary_conditions: { x: true, y: true, z: true }
                }
            };
        }

        return {
            metadata: metadataWithCell,
            positions: result.positions,
            types: result.types,
            ids: result.ids,
            min: result.min,
            max: result.max
        };
    }

    public canParse(headerLines: string[]): boolean {
        const content = headerLines.join('\n');
        const hasAtomsDef = /^\s*\d+\s+atoms/m.test(content);
        const hasBounds = /(xlo\s+xhi|ylo\s+yhi|zlo\s+zhi)/m.test(content);
        return hasAtomsDef && hasBounds;
    }

    public parseMetadataOnly(headerLines: string[]): FrameMetadata {
        let timestep = 0;
        let natoms = 0;
        let headers: string[] = [];
        let simulationCell: any = {
            boundingBox: { width: 0, height: 0, length: 0 },
            geometry: {
                cell_vectors: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
                cell_origin: [0, 0, 0],
                periodic_boundary_conditions: { x: true, y: true, z: true }
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

        const floatRegex = "([+-]?\\d*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)";
        const xMatch = content.match(new RegExp(`^\\s*${floatRegex}\\s+${floatRegex}\\s+xlo\\s+xhi`, 'm'));
        const yMatch = content.match(new RegExp(`^\\s*${floatRegex}\\s+${floatRegex}\\s+ylo\\s+yhi`, 'm'));
        const zMatch = content.match(new RegExp(`^\\s*${floatRegex}\\s+${floatRegex}\\s+zlo\\s+zhi`, 'm'));
        const tiltMatch = content.match(new RegExp(`^\\s*${floatRegex}\\s+${floatRegex}\\s+${floatRegex}\\s+xy\\s+xz\\s+yz`, 'm'));

        if (xMatch && yMatch && zMatch) {
            const xlo_bound = Number(xMatch[1]);
            const xhi_bound = Number(xMatch[2]);
            const ylo_bound = Number(yMatch[1]);
            const yhi_bound = Number(yMatch[2]);
            const zlo_bound = Number(zMatch[1]);
            const zhi_bound = Number(zMatch[2]);

            if (tiltMatch) {
                const xy = Number(tiltMatch[1]);
                const xz = Number(tiltMatch[2]);
                const yz = Number(tiltMatch[3]);

                const xlo = xlo_bound - Math.min(0.0, xy, xz, xy + xz);
                const xhi = xhi_bound - Math.max(0.0, xy, xz, xy + xz);
                const ylo = ylo_bound - Math.min(0.0, yz);
                const yhi = yhi_bound - Math.max(0.0, yz);
                const zlo = zlo_bound;
                const zhi = zhi_bound;

                simulationCell.geometry.cell_vectors = [
                    [xhi - xlo, 0, 0],
                    [xy, yhi - ylo, 0],
                    [xz, yz, zhi - zlo]
                ];
                simulationCell.geometry.cell_origin = [xlo, ylo, zlo];
                simulationCell.boundingBox.width = xhi - xlo;
                simulationCell.boundingBox.length = yhi - ylo;
                simulationCell.boundingBox.height = zhi - zlo;
            } else {
                const width = xhi_bound - xlo_bound;
                const length = yhi_bound - ylo_bound;
                const height = zhi_bound - zlo_bound;

                simulationCell.geometry.cell_vectors = [
                    [width, 0, 0],
                    [0, length, 0],
                    [0, 0, height]
                ];
                simulationCell.geometry.cell_origin = [xlo_bound, ylo_bound, zlo_bound];
                simulationCell.boundingBox.width = width;
                simulationCell.boundingBox.length = length;
                simulationCell.boundingBox.height = height;
            }
        }

        return { timestep, natoms, headers, simulationCell };
    }
};