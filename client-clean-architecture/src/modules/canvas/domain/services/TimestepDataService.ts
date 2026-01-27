import type { TimestepData } from '@/types/stores/editor/timesteps';

export class TimestepDataService {
    extractTimesteps(frames: Array<{ timestep: number }>): number[] {
        if (!frames || frames.length === 0) return [];
        return Array.from(new Set(frames.map((frame) => frame.timestep)))
            .sort((a, b) => a - b);
    }

    createTimestepData(timesteps: number[]): TimestepData {
        return {
            timesteps,
            minTimestep: timesteps[0] || 0,
            maxTimestep: timesteps[timesteps.length - 1] || 0,
            timestepCount: timesteps.length
        };
    }

    buildFromFrames(frames: Array<{ timestep: number }>): TimestepData {
        const timesteps = this.extractTimesteps(frames);
        return this.createTimestepData(timesteps);
    }
}
