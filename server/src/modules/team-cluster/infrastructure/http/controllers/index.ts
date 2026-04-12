import CompleteTeamClusterDeletionController from '@modules/team-cluster/infrastructure/http/controllers/CompleteTeamClusterDeletionController';
import CreateTeamClusterTransferRequestController from '@modules/team-cluster/infrastructure/http/controllers/CreateTeamClusterTransferRequestController';
import CreateTeamClusterController from '@modules/team-cluster/infrastructure/http/controllers/CreateTeamClusterController';
import GenerateTeamClusterInstallManifestUseCase from '@modules/team-cluster/application/use-cases/GenerateTeamClusterInstallManifestUseCase';
import ProcessTeamClusterHealthcheckUseCase from '@modules/team-cluster/application/use-cases/ProcessTeamClusterHealthcheckUseCase';
import CreateTeamClusterRemoteAccessSessionController from '@modules/team-cluster/infrastructure/http/controllers/CreateTeamClusterRemoteAccessSessionController';
import DeleteTeamClusterByIdController from '@modules/team-cluster/infrastructure/http/controllers/DeleteTeamClusterByIdController';
import DownloadTeamClusterRemoteExplorerObjectController from '@modules/team-cluster/infrastructure/http/controllers/DownloadTeamClusterRemoteExplorerObjectController';
import GetTeamClusterRemoteExplorerNodeController from '@modules/team-cluster/infrastructure/http/controllers/GetTeamClusterRemoteExplorerNodeController';
import GetClusterResourceLimitsController from '@modules/team-cluster/infrastructure/http/controllers/GetClusterResourceLimitsController';
import GetTeamClusterByIdController from '@modules/team-cluster/infrastructure/http/controllers/GetTeamClusterByIdController';
import ListTeamClusterRemoteExplorerEntriesController from '@modules/team-cluster/infrastructure/http/controllers/ListTeamClusterRemoteExplorerEntriesController';
import ListTeamClustersByTeamIdController from '@modules/team-cluster/infrastructure/http/controllers/ListTeamClustersByTeamIdController';
import ListTeamClusterTransferJobsController from '@modules/team-cluster/infrastructure/http/controllers/ListTeamClusterTransferJobsController';
import RecordTeamClusterHeartbeatController from '@modules/team-cluster/infrastructure/http/controllers/RecordTeamClusterHeartbeatController';
import RegenerateTeamClusterEnrollmentTokenController from '@modules/team-cluster/infrastructure/http/controllers/RegenerateTeamClusterEnrollmentTokenController';
import RevealTeamClusterCredentialsController from '@modules/team-cluster/infrastructure/http/controllers/RevealTeamClusterCredentialsController';
import UpdateTeamClusterLifecycleController from '@modules/team-cluster/infrastructure/http/controllers/UpdateTeamClusterLifecycleController';
import UpdateTeamClusterQueueConcurrencyController from '@modules/team-cluster/infrastructure/http/controllers/UpdateTeamClusterQueueConcurrencyController';
import UpdateTeamClusterRoleController from '@modules/team-cluster/infrastructure/http/controllers/UpdateTeamClusterRoleController';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

const GenerateTeamClusterInstallManifestController = createController(GenerateTeamClusterInstallManifestUseCase);
const ProcessTeamClusterHealthcheckController = createController(ProcessTeamClusterHealthcheckUseCase);

export default createControllerRegistry({
    completeDeletion: CompleteTeamClusterDeletionController,
    create: CreateTeamClusterController,
    createRemoteAccessSession: CreateTeamClusterRemoteAccessSessionController,
    createTransferRequest: CreateTeamClusterTransferRequestController,
    deleteById: DeleteTeamClusterByIdController,
    downloadRemoteExplorerObject: DownloadTeamClusterRemoteExplorerObjectController,
    generateInstallManifest: GenerateTeamClusterInstallManifestController,
    getById: GetTeamClusterByIdController,
    getResourceLimits: GetClusterResourceLimitsController,
    getRemoteExplorerNode: GetTeamClusterRemoteExplorerNodeController,
    listByTeamId: ListTeamClustersByTeamIdController,
    listRemoteExplorerEntries: ListTeamClusterRemoteExplorerEntriesController,
    listTransferJobs: ListTeamClusterTransferJobsController,
    processHealthcheck: ProcessTeamClusterHealthcheckController,
    recordHeartbeat: RecordTeamClusterHeartbeatController,
    regenerateEnrollmentToken: RegenerateTeamClusterEnrollmentTokenController,
    revealCredentials: RevealTeamClusterCredentialsController,
    updateLifecycle: UpdateTeamClusterLifecycleController,
    updateQueueConcurrency: UpdateTeamClusterQueueConcurrencyController,
    updateRole: UpdateTeamClusterRoleController
});
