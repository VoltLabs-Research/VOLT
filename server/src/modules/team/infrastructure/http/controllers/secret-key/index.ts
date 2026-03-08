import CreateSecretKeyController from './CreateSecretKeyController';
import DeleteSecretKeyByIdController from './DeleteSecretKeyByIdController';
import GetCurrentSecretKeyController from './GetCurrentSecretKeyController';
import GetSecretKeyTeamMetricsController from './GetSecretKeyTeamMetricsController';
import GetSecretKeyUsageController from './GetSecretKeyUsageController';
import ListSecretKeysByTeamIdController from './ListSecretKeysByTeamIdController';
import RevokeSecretKeyByIdController from './RevokeSecretKeyByIdController';
import { container } from 'tsyringe';

export default {
    create: container.resolve(CreateSecretKeyController),
    current: container.resolve(GetCurrentSecretKeyController),
    listByTeamId: container.resolve(ListSecretKeysByTeamIdController),
    revokeById: container.resolve(RevokeSecretKeyByIdController),
    deleteById: container.resolve(DeleteSecretKeyByIdController),
    teamMetrics: container.resolve(GetSecretKeyTeamMetricsController),
    keyUsage: container.resolve(GetSecretKeyUsageController)
};
