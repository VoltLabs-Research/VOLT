import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';

export interface RegenerateTeamClusterEnrollmentTokenInputDTO extends TeamUserScopedInputDTO {
    teamClusterId: string;
};

export interface RegenerateTeamClusterEnrollmentTokenOutputDTO {
    enrollmentToken: string;
};
