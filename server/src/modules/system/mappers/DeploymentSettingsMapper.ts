import DeploymentSettings, {
    DeploymentSettingsProps
} from '@modules/system/entities/DeploymentSettings';
import { DeploymentSettingsDocument } from '@modules/system/models/DeploymentSettingsModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<DeploymentSettings, DeploymentSettingsProps, DeploymentSettingsDocument>(
    DeploymentSettings,
    ['defaultTeam']
);
