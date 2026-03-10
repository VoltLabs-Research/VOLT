import CreateSecretKeyController from './CreateSecretKeyController';
import DeleteSecretKeyByIdController from './DeleteSecretKeyByIdController';
import GetCurrentSecretKeyController from './GetCurrentSecretKeyController';
import GetSecretKeyTeamMetricsController from './GetSecretKeyTeamMetricsController';
import GetSecretKeyUsageController from './GetSecretKeyUsageController';
import ListSecretKeysByTeamIdController from './ListSecretKeysByTeamIdController';
import RevokeSecretKeyByIdController from './RevokeSecretKeyByIdController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    create: CreateSecretKeyController,
    current: GetCurrentSecretKeyController,
    listByTeamId: ListSecretKeysByTeamIdController,
    revokeById: RevokeSecretKeyByIdController,
    deleteById: DeleteSecretKeyByIdController,
    teamMetrics: GetSecretKeyTeamMetricsController,
    keyUsage: GetSecretKeyUsageController
});