export interface ParsedSimulationCellGeometry {
    cell_vectors: [[number, number, number], [number, number, number], [number, number, number]];
    cell_origin: [number, number, number];
    periodic_boundary_conditions: { x: boolean; y: boolean; z: boolean };
}

export interface ParsedSimulationCell {
    boundingBox: { width: number; height: number; length: number };
    geometry: ParsedSimulationCellGeometry;
}

export interface ParsedFrameMetadata {
    timestep: number;
    natoms: number;
    headers: string[];
    simulationCell: ParsedSimulationCell;
}

export interface SimulationCellBounds {
    xlo: number;
    xhi: number;
    ylo: number;
    yhi: number;
    zlo: number;
    zhi: number;
    xy?: number;
    xz?: number;
    yz?: number;
}

export type LammpsMetadataFormat = 'dump' | 'data';

export const LAMMPS_FLOAT_PATTERN = '([+-]?\\d*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)';

export const createSimulationCell = (
    periodicBoundaryConditions: ParsedSimulationCell['geometry']['periodic_boundary_conditions']
): ParsedSimulationCell => ({
    boundingBox: { width: 0, height: 0, length: 0 },
    geometry: {
        cell_vectors: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
        cell_origin: [0, 0, 0],
        periodic_boundary_conditions: periodicBoundaryConditions
    }
});

export const applySimulationCellBounds = (
    simulationCell: ParsedSimulationCell,
    bounds: SimulationCellBounds
): void => {
    const { boundingBox, geometry } = simulationCell;

    if (bounds.xy !== undefined && bounds.xz !== undefined && bounds.yz !== undefined) {
        const { xy, xz, yz } = bounds;
        const xlo = bounds.xlo - Math.min(0.0, xy, xz, xy + xz);
        const xhi = bounds.xhi - Math.max(0.0, xy, xz, xy + xz);
        const ylo = bounds.ylo - Math.min(0.0, yz);
        const yhi = bounds.yhi - Math.max(0.0, yz);

        geometry.cell_vectors = [
            [xhi - xlo, 0, 0],
            [xy, yhi - ylo, 0],
            [xz, yz, bounds.zhi - bounds.zlo]
        ];
        geometry.cell_origin = [xlo, ylo, bounds.zlo];
        boundingBox.width = xhi - xlo;
        boundingBox.length = yhi - ylo;
        boundingBox.height = bounds.zhi - bounds.zlo;
        return;
    }

    const width = bounds.xhi - bounds.xlo;
    const length = bounds.yhi - bounds.ylo;
    const height = bounds.zhi - bounds.zlo;

    geometry.cell_vectors = [
        [width, 0, 0],
        [0, length, 0],
        [0, 0, height]
    ];
    geometry.cell_origin = [bounds.xlo, bounds.ylo, bounds.zlo];
    boundingBox.width = width;
    boundingBox.length = length;
    boundingBox.height = height;
};

export const parseLammpsDumpMetadata = (headerLines: string[]): ParsedFrameMetadata => {
    let timestep = 0;
    let natoms = 0;
    let headers: string[] = [];
    const simulationCell = createSimulationCell({ x: false, y: false, z: false });

    for (let index = 0; index < headerLines.length; index += 1) {
        const line = headerLines[index].trim();
        if (line.includes('ITEM: TIMESTEP') && headerLines[index + 1]) {
            timestep = Number(headerLines[index + 1]);
        } else if (line.includes('ITEM: NUMBER OF ATOMS') && headerLines[index + 1]) {
            natoms = Number(headerLines[index + 1]);
        } else if (line.includes('ITEM: BOX BOUNDS') && headerLines[index + 3]) {
            const parts = line.split(/\s+/);
            const pbcStartIndex = parts.length >= 6 && parts[3] === 'xy' ? 6 : 3;

            simulationCell.geometry.periodic_boundary_conditions = {
                x: parts.length > pbcStartIndex ? parts[pbcStartIndex].startsWith('p') : true,
                y: parts.length > pbcStartIndex + 1 ? parts[pbcStartIndex + 1].startsWith('p') : true,
                z: parts.length > pbcStartIndex + 2 ? parts[pbcStartIndex + 2].startsWith('p') : true
            };

            const row1 = headerLines[index + 1].trim().split(/\s+/).map(Number);
            const row2 = headerLines[index + 2].trim().split(/\s+/).map(Number);
            const row3 = headerLines[index + 3].trim().split(/\s+/).map(Number);

            applySimulationCellBounds(
                simulationCell,
                pbcStartIndex === 6
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

export const parseLammpsDataMetadata = (headerLines: string[]): ParsedFrameMetadata => {
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

    return {
        timestep,
        natoms,
        headers,
        simulationCell
    };
};

export const detectLammpsMetadataFormat = (headerLines: string[]): LammpsMetadataFormat | null => {
    if (headerLines.some((line) => line.includes('ITEM: TIMESTEP'))) {
        return 'dump';
    }

    const content = headerLines.join('\n');
    if (/^\s*\d+\s+atoms/m.test(content) && /(xlo\s+xhi|ylo\s+yhi|zlo\s+zhi)/m.test(content)) {
        return 'data';
    }

    return null;
};

export const parseLammpsMetadata = (headerLines: string[]): ParsedFrameMetadata => {
    const format = detectLammpsMetadataFormat(headerLines);
    if (format === 'dump') {
        return parseLammpsDumpMetadata(headerLines);
    }
    if (format === 'data') {
        return parseLammpsDataMetadata(headerLines);
    }

    throw new Error('Unsupported trajectory format');
};
