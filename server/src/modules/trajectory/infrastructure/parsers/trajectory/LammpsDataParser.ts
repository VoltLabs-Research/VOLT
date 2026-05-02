import { FrameMetadata } from '@modules/trajectory/domain/contracts/trajectory';
import {
    applySimulationCellBounds,
    createSimulationCell,
    LAMMPS_FLOAT_PATTERN
} from '@modules/trajectory/infrastructure/parsers/trajectory/lammps-simulation-cell';

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
        const headers: string[] = [];
        const simulationCell = createSimulationCell({ x: true, y: true, z: true });

        const content = headerLines.join('\n');
        const timestepMatch = content.match(/timestep\s*=\s*(\d+)/i);
        if (timestepMatch) {
            timestep = Number(timestepMatch[1]);
        }

        const atomsMatch = content.match(/^\s*(\d+)\s+atoms/m);
        if (atomsMatch) {
            natoms = Number(atomsMatch[1]);
        }

        const xMatch = content.match(new RegExp(`^\\s*${LAMMPS_FLOAT_PATTERN}\\s+${LAMMPS_FLOAT_PATTERN}\\s+xlo\\s+xhi`, 'm'));
        const yMatch = content.match(new RegExp(`^\\s*${LAMMPS_FLOAT_PATTERN}\\s+${LAMMPS_FLOAT_PATTERN}\\s+ylo\\s+yhi`, 'm'));
        const zMatch = content.match(new RegExp(`^\\s*${LAMMPS_FLOAT_PATTERN}\\s+${LAMMPS_FLOAT_PATTERN}\\s+zlo\\s+zhi`, 'm'));
        const tiltMatch = content.match(new RegExp(`^\\s*${LAMMPS_FLOAT_PATTERN}\\s+${LAMMPS_FLOAT_PATTERN}\\s+${LAMMPS_FLOAT_PATTERN}\\s+xy\\s+xz\\s+yz`, 'm'));

        if (xMatch && yMatch && zMatch) {
            applySimulationCellBounds(simulationCell, {
                xlo: Number(xMatch[1]),
                xhi: Number(xMatch[2]),
                ylo: Number(yMatch[1]),
                yhi: Number(yMatch[2]),
                zlo: Number(zMatch[1]),
                zhi: Number(zMatch[2]),
                ...(tiltMatch ? {
                    xy: Number(tiltMatch[1]),
                    xz: Number(tiltMatch[2]),
                    yz: Number(tiltMatch[3])
                } : {})
            });
        }

        return { timestep, natoms, headers, simulationCell };
    }
}
