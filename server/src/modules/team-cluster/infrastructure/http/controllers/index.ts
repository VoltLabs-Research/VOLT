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
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    completeDeletion: CompleteTeamClusterDeletionController,
    create: CreateTeamClusterController,
    deleteById: DeleteTeamClusterByIdController,
    generateInstallManifest: GenerateTeamClusterInstallManifestController,
    getById: GetTeamClusterByIdController,
    listByTeamId: ListTeamClustersByTeamIdController,
    processHealthcheck: ProcessTeamClusterHealthcheckController,
    recordHeartbeat: RecordTeamClusterHeartbeatController,
    revealCredentials: RevealTeamClusterCredentialsController,
    updateLifecycle: UpdateTeamClusterLifecycleController
});