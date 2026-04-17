import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { ParsedTrajectory } from '@/core/runtime/infrastructure/native/NativeModuleLoader';

interface FrameMetadata {
    timestep: number;
    natoms: number;
    headers: string[];
    simulationCell: ParsedTrajectory['metadata']['simulationCell'];
}

type SimulationCell = FrameMetadata['simulationCell'];
type SimulationCellGeometry = SimulationCell['geometry'];

const createSimulationCell = (periodicBoundaryConditions: SimulationCellGeometry['periodic_boundary_conditions']): SimulationCell => {
    return {
        boundingBox: {
            width: 0,
            height: 0,
            length: 0
        },
        geometry: {
            cell_vectors: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
            cell_origin: [0, 0, 0],
            periodic_boundary_conditions: periodicBoundaryConditions
        }
    };
};

const parseDumpMetadataOnly = (headerLines: string[]): FrameMetadata => {
        let timestep = 0;
        let natoms = 0;
        let headers: string[] = [];
        const simulationCell = createSimulationCell({ x: false, y: false, z: false });
        const geometry = simulationCell.geometry;
        const boundingBox = simulationCell.boundingBox;

        for (let index = 0; index < headerLines.length; index += 1) {
            const line = headerLines[index].trim();
            if (line.includes('ITEM: TIMESTEP') && headerLines[index + 1]) {
                timestep = Number(headerLines[index + 1]);
            } else if (line.includes('ITEM: NUMBER OF ATOMS') && headerLines[index + 1]) {
                natoms = Number(headerLines[index + 1]);
            } else if (line.includes('ITEM: BOX BOUNDS') && headerLines[index + 3]) {
                const parts = line.split(/\s+/);
                let pbcStartIndex = 3;
                if (parts.length >= 6 && parts[3] === 'xy') {
                    pbcStartIndex = 6;
                }

                const periodicBoundaryConditions = {
                    x: parts.length > pbcStartIndex ? parts[pbcStartIndex].startsWith('p') : true,
                    y: parts.length > pbcStartIndex + 1 ? parts[pbcStartIndex + 1].startsWith('p') : true,
                    z: parts.length > pbcStartIndex + 2 ? parts[pbcStartIndex + 2].startsWith('p') : true
                };

                geometry.periodic_boundary_conditions = periodicBoundaryConditions;

                const row1 = headerLines[index + 1].trim().split(/\s+/).map(Number);
                const row2 = headerLines[index + 2].trim().split(/\s+/).map(Number);
                const row3 = headerLines[index + 3].trim().split(/\s+/).map(Number);

                if (pbcStartIndex === 6) {
                    const xy = row1[2] || 0;
                    const xz = row2[2] || 0;
                    const yz = row3[2] || 0;

                    const xloBound = row1[0] || 0;
                    const xhiBound = row1[1] || 0;
                    const yloBound = row2[0] || 0;
                    const yhiBound = row2[1] || 0;
                    const zloBound = row3[0] || 0;
                    const zhiBound = row3[1] || 0;

                    const xlo = xloBound - Math.min(0.0, xy, xz, xy + xz);
                    const xhi = xhiBound - Math.max(0.0, xy, xz, xy + xz);
                    const ylo = yloBound - Math.min(0.0, yz);
                    const yhi = yhiBound - Math.max(0.0, yz);
                    const zlo = zloBound;
                    const zhi = zhiBound;

                    geometry.cell_vectors = [
                        [xhi - xlo, 0, 0],
                        [xy, yhi - ylo, 0],
                        [xz, yz, zhi - zlo]
                    ];
                    geometry.cell_origin = [xlo, ylo, zlo];
                    boundingBox.width = xhi - xlo;
                    boundingBox.length = yhi - ylo;
                    boundingBox.height = zhi - zlo;
                } else {
                    const width = row1[1] - row1[0];
                    const length = row2[1] - row2[0];
                    const height = row3[1] - row3[0];

                    geometry.cell_vectors = [
                        [width, 0, 0],
                        [0, length, 0],
                        [0, 0, height]
                    ];
                    geometry.cell_origin = [row1[0], row2[0], row3[0]];
                    boundingBox.width = width;
                    boundingBox.length = length;
                    boundingBox.height = height;
                }
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
};

const parseDataMetadataOnly = (headerLines: string[]): FrameMetadata => {
        let timestep = 0;
        let natoms = 0;
        const headers: string[] = [];
        const simulationCell = createSimulationCell({ x: true, y: true, z: true });
        const geometry = simulationCell.geometry;
        const boundingBox = simulationCell.boundingBox;

        const content = headerLines.join('\n');
        const timestepMatch = content.match(/timestep\s*=\s*(\d+)/i);
        if (timestepMatch) {
            timestep = Number(timestepMatch[1]);
        }

        const atomsMatch = content.match(/^\s*(\d+)\s+atoms/m);
        if (atomsMatch) {
            natoms = Number(atomsMatch[1]);
        }

        const floatRegex = '([+-]?\\d*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)';
        const xMatch = content.match(new RegExp(`^\\s*${floatRegex}\\s+${floatRegex}\\s+xlo\\s+xhi`, 'm'));
        const yMatch = content.match(new RegExp(`^\\s*${floatRegex}\\s+${floatRegex}\\s+ylo\\s+yhi`, 'm'));
        const zMatch = content.match(new RegExp(`^\\s*${floatRegex}\\s+${floatRegex}\\s+zlo\\s+zhi`, 'm'));
        const tiltMatch = content.match(new RegExp(`^\\s*${floatRegex}\\s+${floatRegex}\\s+${floatRegex}\\s+xy\\s+xz\\s+yz`, 'm'));

        if (xMatch && yMatch && zMatch) {
            const xloBound = Number(xMatch[1]);
            const xhiBound = Number(xMatch[2]);
            const yloBound = Number(yMatch[1]);
            const yhiBound = Number(yMatch[2]);
            const zloBound = Number(zMatch[1]);
            const zhiBound = Number(zMatch[2]);

            if (tiltMatch) {
                const xy = Number(tiltMatch[1]);
                const xz = Number(tiltMatch[2]);
                const yz = Number(tiltMatch[3]);

                const xlo = xloBound - Math.min(0.0, xy, xz, xy + xz);
                const xhi = xhiBound - Math.max(0.0, xy, xz, xy + xz);
                const ylo = yloBound - Math.min(0.0, yz);
                const yhi = yhiBound - Math.max(0.0, yz);
                const zlo = zloBound;
                const zhi = zhiBound;

                geometry.cell_vectors = [
                    [xhi - xlo, 0, 0],
                    [xy, yhi - ylo, 0],
                    [xz, yz, zhi - zlo]
                ];
                geometry.cell_origin = [xlo, ylo, zlo];
                boundingBox.width = xhi - xlo;
                boundingBox.length = yhi - ylo;
                boundingBox.height = zhi - zlo;
            } else {
                const width = xhiBound - xloBound;
                const length = yhiBound - yloBound;
                const height = zhiBound - zloBound;

                geometry.cell_vectors = [
                    [width, 0, 0],
                    [0, length, 0],
                    [0, 0, height]
                ];
                geometry.cell_origin = [xloBound, yloBound, zloBound];
                boundingBox.width = width;
                boundingBox.length = length;
                boundingBox.height = height;
            }
        }

        return {
            timestep,
            natoms,
            headers,
            simulationCell
        };
};

export class TrajectoryParserFactory {
    static async parseMetadata(filePath: string): Promise<FrameMetadata> {
        const headerLines = await new Promise<string[]>((resolve, reject) => {
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
                if (lines.length >= 200) {
                    rl.close();
                    stream.destroy();
                }
            });

            rl.on('close', () => resolve(lines));
            rl.on('error', reject);
            stream.on('error', reject);
        });

        if (headerLines.some((line) => line.includes('ITEM: TIMESTEP'))) {
            return parseDumpMetadataOnly(headerLines);
        }

        const content = headerLines.join('\n');
        if (/^\s*\d+\s+atoms/m.test(content) && /(xlo\s+xhi|ylo\s+yhi|zlo\s+zhi)/m.test(content)) {
            return parseDataMetadataOnly(headerLines);
        }

        throw new Error('Unsupported trajectory format');
    }
}
