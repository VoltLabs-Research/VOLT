import type { BoxBounds } from '@/modules/fractal/presentation/types';
import type { Trajectory, TimestepInfo } from '@/modules/trajectory/domain/entities';
import type { SimulationCell } from '@/modules/simulation-cell/domain/entities';

const getSimulationCellBoxBounds = (simulationCell?: SimulationCell): BoxBounds | undefined => {
    if (!simulationCell) {
        return undefined;
    }

    const { boundingBox, geometry } = simulationCell;
    const cellOrigin = geometry?.cell_origin;

    if (!boundingBox || !cellOrigin || cellOrigin.length !== 3) {
        return undefined;
    }

    const [xlo, ylo, zlo] = cellOrigin;

    return {
        xlo,
        xhi: xlo + boundingBox.width,
        ylo,
        yhi: ylo + boundingBox.length,
        zlo,
        zhi: zlo + boundingBox.height
    };
};

export const getFrameBoxBounds = (frame: TimestepInfo): BoxBounds => {
    const simulationCellBoxBounds = getSimulationCellBoxBounds(frame.simulationCell);

    if (simulationCellBoxBounds) {
        return simulationCellBoxBounds;
    }

    if (frame.boxBounds) {
        return frame.boxBounds;
    }

    throw new Error(`Frame ${frame.timestep} is missing canonical box bounds.`);
};

export const getTrajectoryFrameByTimestep = (
    trajectory: Pick<Trajectory, 'frames'> | null | undefined,
    currentTimestep: number | undefined
): TimestepInfo | undefined => {
    if (!trajectory || currentTimestep === undefined) {
        return undefined;
    }

    return trajectory.frames.find((frame: TimestepInfo) => frame.timestep === currentTimestep);
};
