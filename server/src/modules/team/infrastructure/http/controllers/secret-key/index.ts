import { container } from 'tsyringe';
import CreateSecretKeyController from './CreateSecretKeyController';
import GetCurrentSecretKeyController from './GetCurrentSecretKeyController';
import ListSecretKeysByTeamIdController from './ListSecretKeysByTeamIdController';
import RevokeSecretKeyByIdController from './RevokeSecretKeyByIdController';
import DeleteSecretKeyByIdController from './DeleteSecretKeyByIdController';
import GetSecretKeyTeamMetricsController from './GetSecretKeyTeamMetricsController';
import GetSecretKeyUsageController from './GetSecretKeyUsageController';

export default {
    create: container.resolve(CreateSecretKeyController),
    current: container.resolve(GetCurrentSecretKeyController),
    listByTeamId: container.resolve(ListSecretKeysByTeamIdController),
    revokeById: container.resolve(RevokeSecretKeyByIdController),
    deleteById: container.resolve(DeleteSecretKeyByIdController),
    teamMetrics: container.resolve(GetSecretKeyTeamMetricsController),
    keyUsage: container.resolve(GetSecretKeyUsageController)
};
