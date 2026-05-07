import CompleteTeamClusterDeletionController from '@modules/cluster/infrastructure/http/controllers/CompleteTeamClusterDeletionController';
import CreateTeamClusterTransferRequestController from '@modules/cluster/infrastructure/http/controllers/CreateTeamClusterTransferRequestController';
import CreateTeamClusterController from '@modules/cluster/infrastructure/http/controllers/CreateTeamClusterController';
import DeleteDemoTeamClusterController from '@modules/cluster/infrastructure/http/controllers/DeleteDemoTeamClusterController';
import GenerateTeamClusterInstallManifestUseCase from '@modules/cluster/application/use-cases/GenerateTeamClusterInstallManifestUseCase';
import GetDemoTeamClusterStatusController from '@modules/cluster/infrastructure/http/controllers/GetDemoTeamClusterStatusController';
import ProcessTeamClusterHealthcheckUseCase from '@modules/cluster/application/use-cases/ProcessTeamClusterHealthcheckUseCase';
import ProvisionDemoTeamClusterController from '@modules/cluster/infrastructure/http/controllers/ProvisionDemoTeamClusterController';
import CreateTeamClusterRemoteAccessSessionController from '@modules/cluster/infrastructure/http/controllers/CreateTeamClusterRemoteAccessSessionController';
import DeleteTeamClusterByIdController from '@modules/cluster/infrastructure/http/controllers/DeleteTeamClusterByIdController';
import DownloadTeamClusterRemoteExplorerObjectController from '@modules/cluster/infrastructure/http/controllers/DownloadTeamClusterRemoteExplorerObjectController';
import GetTeamClusterRemoteExplorerNodeController from '@modules/cluster/infrastructure/http/controllers/GetTeamClusterRemoteExplorerNodeController';
import GetClusterResourceLimitsController from '@modules/cluster/infrastructure/http/controllers/GetClusterResourceLimitsController';
import GetTeamClusterByIdController from '@modules/cluster/infrastructure/http/controllers/GetTeamClusterByIdController';
import GetTeamClusterRuntimeSnapshotController from '@modules/cluster/infrastructure/http/controllers/GetTeamClusterRuntimeSnapshotController';
import ListTeamClusterRemoteExplorerEntriesController from '@modules/cluster/infrastructure/http/controllers/ListTeamClusterRemoteExplorerEntriesController';
import ListTeamClustersByTeamIdController from '@modules/cluster/infrastructure/http/controllers/ListTeamClustersByTeamIdController';
import ListTeamClusterTransferJobsController from '@modules/cluster/infrastructure/http/controllers/ListTeamClusterTransferJobsController';
import RecordTeamClusterHeartbeatController from '@modules/cluster/infrastructure/http/controllers/RecordTeamClusterHeartbeatController';
import RegenerateTeamClusterEnrollmentTokenController from '@modules/cluster/infrastructure/http/controllers/RegenerateTeamClusterEnrollmentTokenController';
import RevealTeamClusterCredentialsController from '@modules/cluster/infrastructure/http/controllers/RevealTeamClusterCredentialsController';
import UpdateTeamClusterLifecycleController from '@modules/cluster/infrastructure/http/controllers/UpdateTeamClusterLifecycleController';
import UpdateTeamClusterQueueConcurrencyController from '@modules/cluster/infrastructure/http/controllers/UpdateTeamClusterQueueConcurrencyController';
import UpdateTeamClusterRoleController from '@modules/cluster/infrastructure/http/controllers/UpdateTeamClusterRoleController';
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
    deleteDemo: DeleteDemoTeamClusterController,
    downloadRemoteExplorerObject: DownloadTeamClusterRemoteExplorerObjectController,
    generateInstallManifest: GenerateTeamClusterInstallManifestController,
    getById: GetTeamClusterByIdController,
    getDemoStatus: GetDemoTeamClusterStatusController,
    getRuntimeSnapshot: GetTeamClusterRuntimeSnapshotController,
    getResourceLimits: GetClusterResourceLimitsController,
    getRemoteExplorerNode: GetTeamClusterRemoteExplorerNodeController,
    listByTeamId: ListTeamClustersByTeamIdController,
    listRemoteExplorerEntries: ListTeamClusterRemoteExplorerEntriesController,
    listTransferJobs: ListTeamClusterTransferJobsController,
    processHealthcheck: ProcessTeamClusterHealthcheckController,
    provisionDemo: ProvisionDemoTeamClusterController,
    recordHeartbeat: RecordTeamClusterHeartbeatController,
    regenerateEnrollmentToken: RegenerateTeamClusterEnrollmentTokenController,
    revealCredentials: RevealTeamClusterCredentialsController,
    updateLifecycle: UpdateTeamClusterLifecycleController,
    updateQueueConcurrency: UpdateTeamClusterQueueConcurrencyController,
    updateRole: UpdateTeamClusterRoleController
});
