import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

export const ANALYSIS_EXECUTION_METADATA_KEY = '__voltExecution';

interface AnalysisExecutionMetadata {
    selectedTimesteps?: number[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const isFiniteNumber = (value: unknown): value is number => {
    return typeof value === 'number' && Number.isFinite(value);
};

const sanitizeTimestepList = (timesteps: number[], availableTimesteps: number[]): number[] => {
    const availableTimestepsSet = new Set(availableTimesteps);
    const filteredTimesteps = timesteps.filter((timestep) => availableTimestepsSet.has(timestep));

    return Array.from(new Set(filteredTimesteps)).sort((left, right) => left - right);
};

const readSelectedTimesteps = (value: unknown): number[] | undefined => {
    if (!Array.isArray(value)) {
        return undefined;
    }

    return value.filter(isFiniteNumber);
};

const readAnalysisExecutionMetadata = (config: Record<string, unknown>): AnalysisExecutionMetadata | undefined => {
    const reservedMetadata = config[ANALYSIS_EXECUTION_METADATA_KEY];

    if (isRecord(reservedMetadata)) {
        return {
            selectedTimesteps: readSelectedTimesteps(reservedMetadata.selectedTimesteps)
        };
    }

    return undefined;
};

export const extractTrajectoryTimesteps = (trajectory?: Trajectory | null): number[] => {
    if (!trajectory?.frames?.length) {
        return [];
    }

    return Array.from(new Set(
        trajectory.frames
            .map((frame) => frame.timestep)
            .filter(isFiniteNumber)
    )).sort((left, right) => left - right);
};

export const getNearestTimestep = (
    currentTimestep: number | undefined,
    availableTimesteps: number[]
): number | undefined => {
    if (!availableTimesteps.length) {
        return undefined;
    }

    if (currentTimestep === undefined) {
        return availableTimesteps[0];
    }

    if (availableTimesteps.includes(currentTimestep)) {
        return currentTimestep;
    }

    return availableTimesteps.reduce((nearest, timestep) => {
        if (Math.abs(timestep - currentTimestep) < Math.abs(nearest - currentTimestep)) {
            return timestep;
        }

        return nearest;
    }, availableTimesteps[0]);
};

export const normalizeSelectedTimesteps = (
    selectedTimesteps: number[] | undefined,
    availableTimesteps: number[]
): number[] | undefined => {
    if (!selectedTimesteps?.length || !availableTimesteps.length) {
        return undefined;
    }

    const sanitizedTimesteps = sanitizeTimestepList(selectedTimesteps, availableTimesteps);
    if (!sanitizedTimesteps.length) {
        return undefined;
    }

    if (sanitizedTimesteps.length === availableTimesteps.length) {
        return undefined;
    }

    return sanitizedTimesteps;
};

export const getSelectedTimestepsForAnalysis = (
    analysis: Analysis | undefined,
    trajectoryTimesteps: number[]
): number[] | undefined => {
    if (!analysis) {
        return undefined;
    }

    const metadata = readAnalysisExecutionMetadata(analysis.config);
    return normalizeSelectedTimesteps(metadata?.selectedTimesteps, trajectoryTimesteps);
};
