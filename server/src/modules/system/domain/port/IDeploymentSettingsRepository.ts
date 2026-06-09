import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type DeploymentSettings from '@modules/system/domain/entities/DeploymentSettings';
import type { DeploymentSettingsProps } from '@modules/system/domain/entities/DeploymentSettings';

export interface IDeploymentSettingsRepository extends IBaseRepository<DeploymentSettings, DeploymentSettingsProps> {
    getSettings(): Promise<DeploymentSettings>;
    setDefaultTeam(teamId: string | null, autoJoinNewMembers: boolean): Promise<DeploymentSettings>;
}
