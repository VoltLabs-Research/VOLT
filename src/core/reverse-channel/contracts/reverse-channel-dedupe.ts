type TimestepDedupeSegment = number | 'none';

const TIMESTEP_DEDUPE_SEGMENT_NONE = 'none';

export const readTimestepDedupeSegment = (timestep?: number): TimestepDedupeSegment => {
    if (timestep === undefined) {
        return TIMESTEP_DEDUPE_SEGMENT_NONE;
    }

    return timestep;
};
