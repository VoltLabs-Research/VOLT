import type { TeamUserScopedClusterInputDTO } from './common';

export type RegenerateTeamClusterEnrollmentTokenInputDTO = TeamUserScopedClusterInputDTO;

export interface RegenerateTeamClusterEnrollmentTokenOutputDTO {
    enrollmentToken: string;
};
