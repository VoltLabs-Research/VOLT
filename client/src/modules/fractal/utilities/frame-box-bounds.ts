import type { BoxBounds } from '@/modules/fractal/types';
import type { TimestepInfo, Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import type { SimulationCell } from '@/modules/simulation-cell/api/entities/simulation-cell';

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
        yhi: ylo + boundingBox.height,
        zlo,
        zhi: zlo + boundingBox.length
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

export const hasFrameBoxBounds = (frame: TimestepInfo): boolean => {
    return Boolean(getSimulationCellBoxBounds(frame.simulationCell) || frame.boxBounds);
};

export const getFirstTrajectoryFrameWithBoxBounds = (
    trajectory: Pick<Trajectory, 'frames'> | null | undefined
): TimestepInfo | undefined => {
    if (!trajectory) {
        return undefined;
    }

    return trajectory.frames.find(hasFrameBoxBounds);
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
