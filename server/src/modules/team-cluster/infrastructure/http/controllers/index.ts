import CompleteTeamClusterDeletionController from '@modules/team-cluster/infrastructure/http/controllers/CompleteTeamClusterDeletionController';
import CreateTeamClusterController from '@modules/team-cluster/infrastructure/http/controllers/CreateTeamClusterController';
import DeleteTeamClusterByIdController from '@modules/team-cluster/infrastructure/http/controllers/DeleteTeamClusterByIdController';
import GenerateTeamClusterInstallManifestController from '@modules/team-cluster/infrastructure/http/controllers/GenerateTeamClusterInstallManifestController';
import GetTeamClusterByIdController from '@modules/team-cluster/infrastructure/http/controllers/GetTeamClusterByIdController';
import ListTeamClustersByTeamIdController from '@modules/team-cluster/infrastructure/http/controllers/ListTeamClustersByTeamIdController';
import ProcessTeamClusterHealthcheckController from '@modules/team-cluster/infrastructure/http/controllers/ProcessTeamClusterHealthcheckController';
import RecordTeamClusterHeartbeatController from '@modules/team-cluster/infrastructure/http/controllers/RecordTeamClusterHeartbeatController';
import RevealTeamClusterCredentialsController from '@modules/team-cluster/infrastructure/http/controllers/RevealTeamClusterCredentialsController';
import UpdateTeamClusterLifecycleController from '@modules/team-cluster/infrastructure/http/controllers/UpdateTeamClusterLifecycleController';
import { container } from 'tsyringe';

export default {
    completeDeletion: container.resolve(CompleteTeamClusterDeletionController),
    create: container.resolve(CreateTeamClusterController),
    deleteById: container.resolve(DeleteTeamClusterByIdController),
    generateInstallManifest: container.resolve(GenerateTeamClusterInstallManifestController),
    getById: container.resolve(GetTeamClusterByIdController),
    listByTeamId: container.resolve(ListTeamClustersByTeamIdController),
    processHealthcheck: container.resolve(ProcessTeamClusterHealthcheckController),
    recordHeartbeat: container.resolve(RecordTeamClusterHeartbeatController),
    revealCredentials: container.resolve(RevealTeamClusterCredentialsController),
    updateLifecycle: container.resolve(UpdateTeamClusterLifecycleController)
};
