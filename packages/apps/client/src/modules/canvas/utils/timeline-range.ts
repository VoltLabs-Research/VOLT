export const resolveRangedTimesteps = (
    timesteps: number[],
    rangeStart?: number,
    rangeEnd?: number
): number[] => {
    if (!timesteps.length) {
        return [];
    }

    const start = rangeStart ?? timesteps[0];
    const end = rangeEnd ?? timesteps[timesteps.length - 1];

    return timesteps.filter((timestep) => timestep >= start && timestep <= end);
};
