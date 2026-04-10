import { buildBackendUrl } from '@/app/core/http/utilities/backend-origin';

export const buildLammpsExecutionGlbUrl = (
    teamId: string,
    executionId: string,
    timestep: number
): string => {
    return buildBackendUrl(`/api/lammps/${teamId}/executions/${executionId}/dumps/${timestep}/glb`);
};
