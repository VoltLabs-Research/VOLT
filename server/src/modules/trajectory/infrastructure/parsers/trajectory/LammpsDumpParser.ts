import { FrameMetadata } from '@modules/trajectory/domain/contracts/trajectory';

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
        let simulationCell: any = {
            boundingBox: { width: 0, height: 0, length: 0 },
            geometry: {
                cell_vectors: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
                cell_origin: [0, 0, 0],
                periodic_boundary_conditions: { x: false, y: false, z: false }
            }
        };

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

                if (pbcStartIdx === 6) { // Triclinic
                    const xy = row1[2] || 0;
                    const xz = row2[2] || 0;
                    const yz = row3[2] || 0;

                    const xlo_bound = row1[0] || 0;
                    const xhi_bound = row1[1] || 0;
                    const ylo_bound = row2[0] || 0;
                    const yhi_bound = row2[1] || 0;
                    const zlo_bound = row3[0] || 0;
                    const zhi_bound = row3[1] || 0;

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

                } else { // Orthogonal

                    const lx = row1[1] - row1[0];
                    const ly = row2[1] - row2[0];
                    const lz = row3[1] - row3[0];

                    simulationCell.geometry.cell_vectors = [
                        [lx, 0, 0],
                        [0, ly, 0],
                        [0, 0, lz]
                    ];
                    simulationCell.geometry.cell_origin = [row1[0], row2[0], row3[0]];

                    simulationCell.boundingBox.width = lx;
                    simulationCell.boundingBox.length = ly;
                    simulationCell.boundingBox.height = lz;
                }

            } else if (line.includes('ITEM: ATOMS')) {
                // Format: ITEM: ATOMS id type x y z ...
                headers = line.replace('ITEM: ATOMS', '').trim().split(/\s+/);
                break;
            }
        }
        return { timestep, natoms, headers, simulationCell };
    }
};
