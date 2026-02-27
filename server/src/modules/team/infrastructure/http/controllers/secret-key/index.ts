import { container } from 'tsyringe';
import CreateSecretKeyController from './CreateSecretKeyController';
import GetCurrentSecretKeyController from './GetCurrentSecretKeyController';
import ListSecretKeysByTeamIdController from './ListSecretKeysByTeamIdController';
import RevokeSecretKeyByIdController from './RevokeSecretKeyByIdController';
import DeleteSecretKeyByIdController from './DeleteSecretKeyByIdController';

export default {
    create: container.resolve(CreateSecretKeyController),
    current: container.resolve(GetCurrentSecretKeyController),
    listByTeamId: container.resolve(ListSecretKeysByTeamIdController),
    revokeById: container.resolve(RevokeSecretKeyByIdController),
    deleteById: container.resolve(DeleteSecretKeyByIdController)
};
