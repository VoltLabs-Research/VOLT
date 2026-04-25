import { FrameMetadata } from '@modules/trajectory/domain/contracts/trajectory';
import {
    applySimulationCellBounds,
    createSimulationCell
} from '@modules/trajectory/infrastructure/parsers/trajectory/lammps-simulation-cell';

/**
 * LAMMPS dump header parser (metadata-only, pure JS).
 * Full parsing and stats computation are delegated to cluster daemons.
 */
export default class LammpsDumpParser {
    public canParse(headerLines: string[]): boolean {
        return headerLines.some((line) => line.includes('ITEM: TIMESTEP'));
    }

    public parseMetadataOnly(headerLines: string[]): FrameMetadata {
        let timestep = 0;
        let natoms = 0;
        let headers: string[] = [];
        const simulationCell = createSimulationCell({ x: false, y: false, z: false });

        for (let i = 0; i < headerLines.length; i++) {
            const line = headerLines[i].trim();
            if (line.includes('ITEM: TIMESTEP') && headerLines[i + 1]) {
                timestep = Number(headerLines[i + 1]);
            } else if (line.includes('ITEM: NUMBER OF ATOMS') && headerLines[i + 1]) {
                natoms = Number(headerLines[i + 1]);
            } else if (line.includes('ITEM: BOX BOUNDS') && headerLines[i + 3]) {
                const parts = line.split(/\s+/);
                let pbcStartIdx = 3;
                if (parts.length >= 6 && (parts[3] === 'xy')) {
                    pbcStartIdx = 6;
                }

                const pbcX = (parts.length > pbcStartIdx) ? parts[pbcStartIdx].startsWith('p') : true;
                const pbcY = (parts.length > pbcStartIdx + 1) ? parts[pbcStartIdx + 1].startsWith('p') : true;
                const pbcZ = (parts.length > pbcStartIdx + 2) ? parts[pbcStartIdx + 2].startsWith('p') : true;

                simulationCell.geometry.periodic_boundary_conditions = { x: pbcX, y: pbcY, z: pbcZ };

                const row1 = headerLines[i + 1].trim().split(/\s+/).map(Number);
                const row2 = headerLines[i + 2].trim().split(/\s+/).map(Number);
                const row3 = headerLines[i + 3].trim().split(/\s+/).map(Number);

                applySimulationCellBounds(
                    simulationCell,
                    pbcStartIdx === 6
                        ? {
                            xlo: row1[0] || 0,
                            xhi: row1[1] || 0,
                            ylo: row2[0] || 0,
                            yhi: row2[1] || 0,
                            zlo: row3[0] || 0,
                            zhi: row3[1] || 0,
                            xy: row1[2] || 0,
                            xz: row2[2] || 0,
                            yz: row3[2] || 0
                        }
                        : {
                            xlo: row1[0],
                            xhi: row1[1],
                            ylo: row2[0],
                            yhi: row2[1],
                            zlo: row3[0],
                            zhi: row3[1]
                        }
                );

            } else if (line.includes('ITEM: ATOMS')) {
                // Format: ITEM: ATOMS id type x y z ...
                headers = line.replace('ITEM: ATOMS', '').trim().split(/\s+/);
                break;
            }
        }
        return { timestep, natoms, headers, simulationCell };
    }
};
