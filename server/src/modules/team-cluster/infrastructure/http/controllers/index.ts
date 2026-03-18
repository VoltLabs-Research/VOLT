import CompleteTeamClusterDeletionController from '@modules/team-cluster/infrastructure/http/controllers/CompleteTeamClusterDeletionController';
import CreateTeamClusterController from '@modules/team-cluster/infrastructure/http/controllers/CreateTeamClusterController';
import FetchAvailableClusterVersionsController from '@modules/team-cluster/infrastructure/http/controllers/FetchAvailableClusterVersionsController';
import CreateTeamClusterRemoteAccessSessionController from '@modules/team-cluster/infrastructure/http/controllers/CreateTeamClusterRemoteAccessSessionController';
import DeleteTeamClusterByIdController from '@modules/team-cluster/infrastructure/http/controllers/DeleteTeamClusterByIdController';
import DownloadTeamClusterRemoteExplorerObjectController from '@modules/team-cluster/infrastructure/http/controllers/DownloadTeamClusterRemoteExplorerObjectController';
import GenerateTeamClusterInstallManifestController from '@modules/team-cluster/infrastructure/http/controllers/GenerateTeamClusterInstallManifestController';
import GetTeamClusterRemoteExplorerNodeController from '@modules/team-cluster/infrastructure/http/controllers/GetTeamClusterRemoteExplorerNodeController';
import GetClusterResourceLimitsController from '@modules/team-cluster/infrastructure/http/controllers/GetClusterResourceLimitsController';
import GetTeamClusterByIdController from '@modules/team-cluster/infrastructure/http/controllers/GetTeamClusterByIdController';
import ListTeamClusterRemoteExplorerEntriesController from '@modules/team-cluster/infrastructure/http/controllers/ListTeamClusterRemoteExplorerEntriesController';
import ListTeamClustersByTeamIdController from '@modules/team-cluster/infrastructure/http/controllers/ListTeamClustersByTeamIdController';
import ProcessTeamClusterHealthcheckController from '@modules/team-cluster/infrastructure/http/controllers/ProcessTeamClusterHealthcheckController';
import RecordTeamClusterHeartbeatController from '@modules/team-cluster/infrastructure/http/controllers/RecordTeamClusterHeartbeatController';
import RegenerateTeamClusterEnrollmentTokenController from '@modules/team-cluster/infrastructure/http/controllers/RegenerateTeamClusterEnrollmentTokenController';
import RequestTeamClusterUpdateController from '@modules/team-cluster/infrastructure/http/controllers/RequestTeamClusterUpdateController';
import RevealTeamClusterCredentialsController from '@modules/team-cluster/infrastructure/http/controllers/RevealTeamClusterCredentialsController';
import UpdateTeamClusterLifecycleController from '@modules/team-cluster/infrastructure/http/controllers/UpdateTeamClusterLifecycleController';
import UpdateTeamClusterRoleController from '@modules/team-cluster/infrastructure/http/controllers/UpdateTeamClusterRoleController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    completeDeletion: CompleteTeamClusterDeletionController,
    create: CreateTeamClusterController,
    createRemoteAccessSession: CreateTeamClusterRemoteAccessSessionController,
    deleteById: DeleteTeamClusterByIdController,
    downloadRemoteExplorerObject: DownloadTeamClusterRemoteExplorerObjectController,
    fetchAvailableVersions: FetchAvailableClusterVersionsController,
    generateInstallManifest: GenerateTeamClusterInstallManifestController,
    getById: GetTeamClusterByIdController,
    getResourceLimits: GetClusterResourceLimitsController,
    getRemoteExplorerNode: GetTeamClusterRemoteExplorerNodeController,
    listByTeamId: ListTeamClustersByTeamIdController,
    listRemoteExplorerEntries: ListTeamClusterRemoteExplorerEntriesController,
    processHealthcheck: ProcessTeamClusterHealthcheckController,
    recordHeartbeat: RecordTeamClusterHeartbeatController,
    regenerateEnrollmentToken: RegenerateTeamClusterEnrollmentTokenController,
    requestUpdate: RequestTeamClusterUpdateController,
    revealCredentials: RevealTeamClusterCredentialsController,
    updateLifecycle: UpdateTeamClusterLifecycleController,
    updateRole: UpdateTeamClusterRoleController
});
