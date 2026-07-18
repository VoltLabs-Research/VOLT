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
import RegenerateTeamClusterEnrollmentTokenUseCase from '@modules/cluster/application/use-cases/RegenerateTeamClusterEnrollmentTokenUseCase';
import RevealTeamClusterCredentialsUseCase from '@modules/cluster/application/use-cases/RevealTeamClusterCredentialsUseCase';
import UpdateTeamClusterQueueConcurrencyUseCase from '@modules/cluster/application/use-cases/UpdateTeamClusterQueueConcurrencyUseCase';
import UpdateTeamClusterRoleUseCase from '@modules/cluster/application/use-cases/UpdateTeamClusterRoleUseCase';
import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { UseCaseInput, UseCaseOutput } from '@shared/application/IUseCase';
import type { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The single HTTP-facing application service for the cluster module. Every
 * method is a thin delegator to a retained use case: it runs the use case and
 * unwraps the `Result` onto the thrown-error channel so Express 5 forwards any
 * failure to the global `httpErrorMiddleware` (equivalent, byte-for-byte, to the
 * generated controllers' `BaseResponse.fromError` path).
 *
 * No orchestration logic lives here — the use cases remain the single source of
 * truth and are still consumed directly by the cluster AI tools, event handlers
 * and cross-module contract ports. This facade exists only to give the one
 * {@link ClusterController} a typed surface to call.
 */
@Singleton(CLUSTER_TOKENS.ClusterHttpService)
export default class ClusterHttpService {
    constructor(
        @inject(CreateTeamClusterUseCase) private readonly createTeamClusterUseCase: CreateTeamClusterUseCase,
        @inject(CreateTeamClusterRemoteAccessSessionUseCase) private readonly createTeamClusterRemoteAccessSessionUseCase: CreateTeamClusterRemoteAccessSessionUseCase,
        @inject(CreateTeamClusterTransferRequestUseCase) private readonly createTeamClusterTransferRequestUseCase: CreateTeamClusterTransferRequestUseCase,
        @inject(DeleteDemoTeamClusterUseCase) private readonly deleteDemoTeamClusterUseCase: DeleteDemoTeamClusterUseCase,
        @inject(DeleteTeamClusterByIdUseCase) private readonly deleteTeamClusterByIdUseCase: DeleteTeamClusterByIdUseCase,
        @inject(DownloadTeamClusterRemoteExplorerObjectUseCase) private readonly downloadTeamClusterRemoteExplorerObjectUseCase: DownloadTeamClusterRemoteExplorerObjectUseCase,
        @inject(GenerateTeamClusterInstallManifestUseCase) private readonly generateTeamClusterInstallManifestUseCase: GenerateTeamClusterInstallManifestUseCase,
        @inject(GetClusterResourceLimitsUseCase) private readonly getClusterResourceLimitsUseCase: GetClusterResourceLimitsUseCase,
        @inject(GetDemoTeamClusterStatusUseCase) private readonly getDemoTeamClusterStatusUseCase: GetDemoTeamClusterStatusUseCase,
        @inject(GetTeamClusterByIdUseCase) private readonly getTeamClusterByIdUseCase: GetTeamClusterByIdUseCase,
        @inject(GetTeamClusterRemoteExplorerNodeUseCase) private readonly getTeamClusterRemoteExplorerNodeUseCase: GetTeamClusterRemoteExplorerNodeUseCase,
        @inject(GetTeamClusterRuntimeSnapshotUseCase) private readonly getTeamClusterRuntimeSnapshotUseCase: GetTeamClusterRuntimeSnapshotUseCase,
        @inject(ListTeamClusterRemoteExplorerEntriesUseCase) private readonly listTeamClusterRemoteExplorerEntriesUseCase: ListTeamClusterRemoteExplorerEntriesUseCase,
        @inject(ListTeamClusterTransferJobsUseCase) private readonly listTeamClusterTransferJobsUseCase: ListTeamClusterTransferJobsUseCase,
        @inject(ListTeamClustersByTeamIdUseCase) private readonly listTeamClustersByTeamIdUseCase: ListTeamClustersByTeamIdUseCase,
        @inject(ProcessTeamClusterHealthcheckUseCase) private readonly processTeamClusterHealthcheckUseCase: ProcessTeamClusterHealthcheckUseCase,
        @inject(ProvisionDemoTeamClusterUseCase) private readonly provisionDemoTeamClusterUseCase: ProvisionDemoTeamClusterUseCase,
        @inject(RegenerateTeamClusterEnrollmentTokenUseCase) private readonly regenerateTeamClusterEnrollmentTokenUseCase: RegenerateTeamClusterEnrollmentTokenUseCase,
        @inject(RevealTeamClusterCredentialsUseCase) private readonly revealTeamClusterCredentialsUseCase: RevealTeamClusterCredentialsUseCase,
        @inject(UpdateTeamClusterQueueConcurrencyUseCase) private readonly updateTeamClusterQueueConcurrencyUseCase: UpdateTeamClusterQueueConcurrencyUseCase,
        @inject(UpdateTeamClusterRoleUseCase) private readonly updateTeamClusterRoleUseCase: UpdateTeamClusterRoleUseCase
    ) {}

    /**
     * Awaits a use-case execution and unwraps the `Result`, throwing the
     * `ApplicationError` on failure so it reaches `httpErrorMiddleware`.
     */
    private async run<T>(execution: Promise<Result<T, ApplicationError>>): Promise<T> {
        const result = await execution;
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    create(
        input: UseCaseInput<CreateTeamClusterUseCase>
    ): Promise<UseCaseOutput<CreateTeamClusterUseCase>> {
        return this.run(this.createTeamClusterUseCase.execute(input));
    }

    createRemoteAccessSession(
        input: UseCaseInput<CreateTeamClusterRemoteAccessSessionUseCase>
    ): Promise<UseCaseOutput<CreateTeamClusterRemoteAccessSessionUseCase>> {
        return this.run(this.createTeamClusterRemoteAccessSessionUseCase.execute(input));
    }

    createTransferRequest(
        input: UseCaseInput<CreateTeamClusterTransferRequestUseCase>
    ): Promise<UseCaseOutput<CreateTeamClusterTransferRequestUseCase>> {
        return this.run(this.createTeamClusterTransferRequestUseCase.execute(input));
    }

    deleteById(
        input: UseCaseInput<DeleteTeamClusterByIdUseCase>
    ): Promise<UseCaseOutput<DeleteTeamClusterByIdUseCase>> {
        return this.run(this.deleteTeamClusterByIdUseCase.execute(input));
    }

    deleteDemo(
        input: UseCaseInput<DeleteDemoTeamClusterUseCase>
    ): Promise<UseCaseOutput<DeleteDemoTeamClusterUseCase>> {
        return this.run(this.deleteDemoTeamClusterUseCase.execute(input));
    }

    downloadRemoteExplorerObject(
        input: UseCaseInput<DownloadTeamClusterRemoteExplorerObjectUseCase>
    ): Promise<UseCaseOutput<DownloadTeamClusterRemoteExplorerObjectUseCase>> {
        return this.run(this.downloadTeamClusterRemoteExplorerObjectUseCase.execute(input));
    }

    generateInstallManifest(
        input: UseCaseInput<GenerateTeamClusterInstallManifestUseCase>
    ): Promise<UseCaseOutput<GenerateTeamClusterInstallManifestUseCase>> {
        return this.run(this.generateTeamClusterInstallManifestUseCase.execute(input));
    }

    getResourceLimits(
        input: UseCaseInput<GetClusterResourceLimitsUseCase>
    ): Promise<UseCaseOutput<GetClusterResourceLimitsUseCase>> {
        return this.run(this.getClusterResourceLimitsUseCase.execute(input));
    }

    getDemoStatus(
        input: UseCaseInput<GetDemoTeamClusterStatusUseCase>
    ): Promise<UseCaseOutput<GetDemoTeamClusterStatusUseCase>> {
        return this.run(this.getDemoTeamClusterStatusUseCase.execute(input));
    }

    getById(
        input: UseCaseInput<GetTeamClusterByIdUseCase>
    ): Promise<UseCaseOutput<GetTeamClusterByIdUseCase>> {
        return this.run(this.getTeamClusterByIdUseCase.execute(input));
    }

    getRemoteExplorerNode(
        input: UseCaseInput<GetTeamClusterRemoteExplorerNodeUseCase>
    ): Promise<UseCaseOutput<GetTeamClusterRemoteExplorerNodeUseCase>> {
        return this.run(this.getTeamClusterRemoteExplorerNodeUseCase.execute(input));
    }

    getRuntimeSnapshot(
        input: UseCaseInput<GetTeamClusterRuntimeSnapshotUseCase>
    ): Promise<UseCaseOutput<GetTeamClusterRuntimeSnapshotUseCase>> {
        return this.run(this.getTeamClusterRuntimeSnapshotUseCase.execute(input));
    }

    listRemoteExplorerEntries(
        input: UseCaseInput<ListTeamClusterRemoteExplorerEntriesUseCase>
    ): Promise<UseCaseOutput<ListTeamClusterRemoteExplorerEntriesUseCase>> {
        return this.run(this.listTeamClusterRemoteExplorerEntriesUseCase.execute(input));
    }

    listTransferJobs(
        input: UseCaseInput<ListTeamClusterTransferJobsUseCase>
    ): Promise<UseCaseOutput<ListTeamClusterTransferJobsUseCase>> {
        return this.run(this.listTeamClusterTransferJobsUseCase.execute(input));
    }

    listByTeamId(
        input: UseCaseInput<ListTeamClustersByTeamIdUseCase>
    ): Promise<UseCaseOutput<ListTeamClustersByTeamIdUseCase>> {
        return this.run(this.listTeamClustersByTeamIdUseCase.execute(input));
    }

    processHealthcheck(
        input: UseCaseInput<ProcessTeamClusterHealthcheckUseCase>
    ): Promise<UseCaseOutput<ProcessTeamClusterHealthcheckUseCase>> {
        return this.run(this.processTeamClusterHealthcheckUseCase.execute(input));
    }

    provisionDemo(
        input: UseCaseInput<ProvisionDemoTeamClusterUseCase>
    ): Promise<UseCaseOutput<ProvisionDemoTeamClusterUseCase>> {
        return this.run(this.provisionDemoTeamClusterUseCase.execute(input));
    }

    regenerateEnrollmentToken(
        input: UseCaseInput<RegenerateTeamClusterEnrollmentTokenUseCase>
    ): Promise<UseCaseOutput<RegenerateTeamClusterEnrollmentTokenUseCase>> {
        return this.run(this.regenerateTeamClusterEnrollmentTokenUseCase.execute(input));
    }

    revealCredentials(
        input: UseCaseInput<RevealTeamClusterCredentialsUseCase>
    ): Promise<UseCaseOutput<RevealTeamClusterCredentialsUseCase>> {
        return this.run(this.revealTeamClusterCredentialsUseCase.execute(input));
    }

    updateQueueConcurrency(
        input: UseCaseInput<UpdateTeamClusterQueueConcurrencyUseCase>
    ): Promise<UseCaseOutput<UpdateTeamClusterQueueConcurrencyUseCase>> {
        return this.run(this.updateTeamClusterQueueConcurrencyUseCase.execute(input));
    }

    updateRole(
        input: UseCaseInput<UpdateTeamClusterRoleUseCase>
    ): Promise<UseCaseOutput<UpdateTeamClusterRoleUseCase>> {
        return this.run(this.updateTeamClusterRoleUseCase.execute(input));
    }
}
