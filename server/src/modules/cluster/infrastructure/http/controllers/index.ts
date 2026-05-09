import CompleteTeamClusterDeletionUseCase from '@modules/cluster/application/use-cases/CompleteTeamClusterDeletionUseCase';
import CreateTeamClusterRemoteAccessSessionUseCase from '@modules/cluster/application/use-cases/CreateTeamClusterRemoteAccessSessionUseCase';
import CreateTeamClusterTransferRequestUseCase from '@modules/cluster/application/use-cases/CreateTeamClusterTransferRequestUseCase';
import CreateTeamClusterUseCase from '@modules/cluster/application/use-cases/CreateTeamClusterUseCase';
import DeleteDemoTeamClusterUseCase from '@modules/cluster/application/use-cases/DeleteDemoTeamClusterUseCase';
import DeleteTeamClusterByIdUseCase from '@modules/cluster/application/use-cases/DeleteTeamClusterByIdUseCase';
import DownloadTeamClusterRemoteExplorerObjectUseCase from '@modules/cluster/application/use-cases/DownloadTeamClusterRemoteExplorerObjectUseCase';
import GenerateTeamClusterInstallManifestUseCase from '@modules/cluster/application/use-cases/GenerateTeamClusterInstallManifestUseCase';
import GetClusterResourceLimitsUseCase from '@modules/cluster/application/use-cases/GetClusterResourceLimitsUseCase';
import GetDemoTeamClusterStatusUseCase from '@modules/cluster/application/use-cases/GetDemoTeamClusterStatusUseCase';
import GetTeamClusterByIdUseCase from '@modules/cluster/application/use-cases/GetTeamClusterByIdUseCase';
import GetTeamClusterRemoteExplorerNodeUseCase from '@modules/cluster/application/use-cases/GetTeamClusterRemoteExplorerNodeUseCase';
import GetTeamClusterRuntimeSnapshotUseCase from '@modules/cluster/application/use-cases/GetTeamClusterRuntimeSnapshotUseCase';
import ListTeamClusterRemoteExplorerEntriesUseCase from '@modules/cluster/application/use-cases/ListTeamClusterRemoteExplorerEntriesUseCase';
import ListTeamClusterTransferJobsUseCase from '@modules/cluster/application/use-cases/ListTeamClusterTransferJobsUseCase';
import ListTeamClustersByTeamIdUseCase from '@modules/cluster/application/use-cases/ListTeamClustersByTeamIdUseCase';
import ProcessTeamClusterHealthcheckUseCase from '@modules/cluster/application/use-cases/ProcessTeamClusterHealthcheckUseCase';
import ProvisionDemoTeamClusterUseCase from '@modules/cluster/application/use-cases/ProvisionDemoTeamClusterUseCase';
import RecordTeamClusterHeartbeatUseCase from '@modules/cluster/application/use-cases/RecordTeamClusterHeartbeatUseCase';
import RegenerateTeamClusterEnrollmentTokenUseCase from '@modules/cluster/application/use-cases/RegenerateTeamClusterEnrollmentTokenUseCase';
import RevealTeamClusterCredentialsUseCase from '@modules/cluster/application/use-cases/RevealTeamClusterCredentialsUseCase';
import UpdateTeamClusterLifecycleUseCase from '@modules/cluster/application/use-cases/UpdateTeamClusterLifecycleUseCase';
import UpdateTeamClusterQueueConcurrencyUseCase from '@modules/cluster/application/use-cases/UpdateTeamClusterQueueConcurrencyUseCase';
import UpdateTeamClusterRoleUseCase from '@modules/cluster/application/use-cases/UpdateTeamClusterRoleUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import {
    createController,
    createPaginatedController,
    createPreparedDownloadStreamController
} from '@shared/infrastructure/http/controllers/createController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

const CompleteTeamClusterDeletionController = createController(CompleteTeamClusterDeletionUseCase);
const CreateTeamClusterRemoteAccessSessionController = createController(CreateTeamClusterRemoteAccessSessionUseCase);
const CreateTeamClusterTransferRequestController = createController(CreateTeamClusterTransferRequestUseCase);
const CreateTeamClusterController = createController(CreateTeamClusterUseCase, {
    statusCode: HttpStatus.Created
});
const DeleteDemoTeamClusterController = createController(DeleteDemoTeamClusterUseCase);
const DeleteTeamClusterByIdController = createController(DeleteTeamClusterByIdUseCase);
const DownloadTeamClusterRemoteExplorerObjectController = createPreparedDownloadStreamController(DownloadTeamClusterRemoteExplorerObjectUseCase);
const GenerateTeamClusterInstallManifestController = createController(GenerateTeamClusterInstallManifestUseCase);
const GetClusterResourceLimitsController = createController(GetClusterResourceLimitsUseCase);
const GetDemoTeamClusterStatusController = createController(GetDemoTeamClusterStatusUseCase);
const GetTeamClusterByIdController = createController(GetTeamClusterByIdUseCase);
const GetTeamClusterRemoteExplorerNodeController = createController(GetTeamClusterRemoteExplorerNodeUseCase);
const GetTeamClusterRuntimeSnapshotController = createController(GetTeamClusterRuntimeSnapshotUseCase);
const ListTeamClusterRemoteExplorerEntriesController = createController(ListTeamClusterRemoteExplorerEntriesUseCase);
const ListTeamClusterTransferJobsController = createPaginatedController(ListTeamClusterTransferJobsUseCase);
const ListTeamClustersByTeamIdController = createPaginatedController(ListTeamClustersByTeamIdUseCase);
const ProcessTeamClusterHealthcheckController = createController(ProcessTeamClusterHealthcheckUseCase);
const ProvisionDemoTeamClusterController = createController(ProvisionDemoTeamClusterUseCase, {
    statusCode: HttpStatus.Created
});
const RecordTeamClusterHeartbeatController = createController(RecordTeamClusterHeartbeatUseCase);
const RegenerateTeamClusterEnrollmentTokenController = createController(RegenerateTeamClusterEnrollmentTokenUseCase);
const RevealTeamClusterCredentialsController = createController(RevealTeamClusterCredentialsUseCase);
const UpdateTeamClusterLifecycleController = createController(UpdateTeamClusterLifecycleUseCase);
const UpdateTeamClusterQueueConcurrencyController = createController(UpdateTeamClusterQueueConcurrencyUseCase);
const UpdateTeamClusterRoleController = createController(UpdateTeamClusterRoleUseCase);

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
