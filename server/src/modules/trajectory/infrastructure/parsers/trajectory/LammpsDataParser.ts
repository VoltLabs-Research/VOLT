import { FrameMetadata } from '@modules/trajectory/domain/contracts/trajectory';

/**
 * LAMMPS data file header parser (metadata-only, pure JS).
 * Full parsing is delegated to cluster daemons.
 */
export default class LammpsDataParser {
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
