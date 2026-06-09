import DeploymentSettings, {
    DeploymentSettingsProps
} from '@modules/system/domain/entities/DeploymentSettings';
import { DeploymentSettingsDocument } from '@modules/system/infrastructure/persistence/mongo/models/DeploymentSettingsModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<DeploymentSettings, DeploymentSettingsProps, DeploymentSettingsDocument>(
    DeploymentSettings,
    ['defaultTeam']
);
