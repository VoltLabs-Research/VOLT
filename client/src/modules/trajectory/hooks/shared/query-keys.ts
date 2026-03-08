import { COLOR_CODING_QUERY_KEYS } from '../color-coding/queries';
import { PARTICLE_FILTER_QUERY_KEYS } from '../particle-filter/queries';
import { SCENE_ARTIFACTS_QUERY_KEYS } from '../scene-artifacts/queries';

export const TRAJECTORY_MODULE_QUERY_KEYS = {
    ...COLOR_CODING_QUERY_KEYS,
    ...PARTICLE_FILTER_QUERY_KEYS,
    ...SCENE_ARTIFACTS_QUERY_KEYS
} as const;
