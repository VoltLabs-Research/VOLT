import type { FrameMetadata } from '@modules/trajectory/domain/contracts/trajectory';

export type ParsedSimulationCell = FrameMetadata['simulationCell'];

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
