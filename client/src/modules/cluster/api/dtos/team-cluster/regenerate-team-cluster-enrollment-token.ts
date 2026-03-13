/**
 * Input parameters for regenerating a cluster enrollment token.
 */
export interface RegenerateTeamClusterEnrollmentTokenInputDTO {
    teamId: string;
    teamClusterId: string;
};

/**
 * Returns the newly generated plaintext enrollment token.
 */
export interface RegenerateTeamClusterEnrollmentTokenOutputDTO {
    enrollmentToken: string;
};
