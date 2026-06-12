/**
 * The canonical definition now lives in the neutral contracts layer
 * (`@shared/contracts/ports/IDeploymentSettingsRepository`) for the
 * detachable-modules migration. That port is generic over the entity/props;
 * this module binds it to the concrete `DeploymentSettings`/
 * `DeploymentSettingsProps` and re-exports so existing importers of this module
 * path compile unchanged.
 */
import type { IDeploymentSettingsRepository as IDeploymentSettingsRepositoryContract } from '@shared/contracts/ports/IDeploymentSettingsRepository';
import type DeploymentSettings from '@modules/system/domain/entities/DeploymentSettings';
import type { DeploymentSettingsProps } from '@modules/system/domain/entities/DeploymentSettings';

export type IDeploymentSettingsRepository = IDeploymentSettingsRepositoryContract<DeploymentSettings, DeploymentSettingsProps>;
