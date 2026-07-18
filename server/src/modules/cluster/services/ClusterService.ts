import CreateTeamClusterRemoteAccessSessionUseCase from '@modules/cluster/use-cases/CreateTeamClusterRemoteAccessSessionUseCase';
import CreateTeamClusterTransferRequestUseCase from '@modules/cluster/use-cases/CreateTeamClusterTransferRequestUseCase';
import CreateTeamClusterUseCase from '@modules/cluster/use-cases/CreateTeamClusterUseCase';
import DeleteDemoTeamClusterUseCase from '@modules/cluster/use-cases/DeleteDemoTeamClusterUseCase';
import DeleteTeamClusterByIdUseCase from '@modules/cluster/use-cases/DeleteTeamClusterByIdUseCase';
import DownloadTeamClusterRemoteExplorerObjectUseCase from '@modules/cluster/use-cases/DownloadTeamClusterRemoteExplorerObjectUseCase';
import GenerateTeamClusterInstallManifestUseCase from '@modules/cluster/use-cases/GenerateTeamClusterInstallManifestUseCase';
import GetClusterResourceLimitsUseCase from '@modules/cluster/use-cases/GetClusterResourceLimitsUseCase';
import GetDemoTeamClusterStatusUseCase from '@modules/cluster/use-cases/GetDemoTeamClusterStatusUseCase';
import GetTeamClusterByIdUseCase from '@modules/cluster/use-cases/GetTeamClusterByIdUseCase';
import GetTeamClusterRemoteExplorerNodeUseCase from '@modules/cluster/use-cases/GetTeamClusterRemoteExplorerNodeUseCase';
import GetTeamClusterRuntimeSnapshotUseCase from '@modules/cluster/use-cases/GetTeamClusterRuntimeSnapshotUseCase';
import ListTeamClusterRemoteExplorerEntriesUseCase from '@modules/cluster/use-cases/ListTeamClusterRemoteExplorerEntriesUseCase';
import ListTeamClusterTransferJobsUseCase from '@modules/cluster/use-cases/ListTeamClusterTransferJobsUseCase';
import ListTeamClustersByTeamIdUseCase from '@modules/cluster/use-cases/ListTeamClustersByTeamIdUseCase';
import ProcessTeamClusterHealthcheckUseCase from '@modules/cluster/use-cases/ProcessTeamClusterHealthcheckUseCase';
import ProvisionDemoTeamClusterUseCase from '@modules/cluster/use-cases/ProvisionDemoTeamClusterUseCase';
import RegenerateTeamClusterEnrollmentTokenUseCase from '@modules/cluster/use-cases/RegenerateTeamClusterEnrollmentTokenUseCase';
import RevealTeamClusterCredentialsUseCase from '@modules/cluster/use-cases/RevealTeamClusterCredentialsUseCase';
import UpdateTeamClusterQueueConcurrencyUseCase from '@modules/cluster/use-cases/UpdateTeamClusterQueueConcurrencyUseCase';
import UpdateTeamClusterRoleUseCase from '@modules/cluster/use-cases/UpdateTeamClusterRoleUseCase';
import type { UseCaseInput, UseCaseOutput } from '@shared/application/IUseCase';
import { container } from 'tsyringe';

/**
 * The single HTTP-facing application service for the cluster module (heavy
 * module, pollium style). It is a plain, `new`-able class — no DI decorator, no
 * `@inject` constructor — so the module's controllers can `new ClusterService()`
 * directly.
 *
 * Each method is a thin delegator to a retained use case resolved once from the
 * DI container in a private field. The use cases throw `ApplicationError`s
 * directly (they propagate to `httpErrorMiddleware` via Express 5 async
 * forwarding), and they remain the single source of orchestration truth — they
 * are still consumed directly by the cluster AI tools, socket module and event
 * handlers.
 *
 * The genuinely-stateful cluster collaborators (the lifecycle service, demo
 * deployment service, reverse-channel service, transfer coordinator/runner,
 * heartbeat monitor, install-manifest service, remote-access session service,
 * object gateway client, daemon client, …) stay in their own `@Singleton`
 * classes and are reached transitively through those use cases — they hold
 * caches / daemon connections / reservation state that must be shared with the
 * socket module and lifecycle, so they are NOT re-`new`ed per request.
 */
export default class ClusterService {
    // Use cases resolved once from the DI container (they and the heavy stateful
    // services they depend on self-register via `@Singleton` / `@injectable` at
    // autoload).
    #createTeamCluster = container.resolve(CreateTeamClusterUseCase);
    #createRemoteAccessSession = container.resolve(CreateTeamClusterRemoteAccessSessionUseCase);
    #createTransferRequest = container.resolve(CreateTeamClusterTransferRequestUseCase);
    #deleteById = container.resolve(DeleteTeamClusterByIdUseCase);
    #deleteDemo = container.resolve(DeleteDemoTeamClusterUseCase);
    #downloadRemoteExplorerObject = container.resolve(DownloadTeamClusterRemoteExplorerObjectUseCase);
    #generateInstallManifest = container.resolve(GenerateTeamClusterInstallManifestUseCase);
    #getResourceLimits = container.resolve(GetClusterResourceLimitsUseCase);
    #getDemoStatus = container.resolve(GetDemoTeamClusterStatusUseCase);
    #getById = container.resolve(GetTeamClusterByIdUseCase);
    #getRemoteExplorerNode = container.resolve(GetTeamClusterRemoteExplorerNodeUseCase);
    #getRuntimeSnapshot = container.resolve(GetTeamClusterRuntimeSnapshotUseCase);
    #listRemoteExplorerEntries = container.resolve(ListTeamClusterRemoteExplorerEntriesUseCase);
    #listTransferJobs = container.resolve(ListTeamClusterTransferJobsUseCase);
    #listByTeamId = container.resolve(ListTeamClustersByTeamIdUseCase);
    #processHealthcheck = container.resolve(ProcessTeamClusterHealthcheckUseCase);
    #provisionDemo = container.resolve(ProvisionDemoTeamClusterUseCase);
    #regenerateEnrollmentToken = container.resolve(RegenerateTeamClusterEnrollmentTokenUseCase);
    #revealCredentials = container.resolve(RevealTeamClusterCredentialsUseCase);
    #updateQueueConcurrency = container.resolve(UpdateTeamClusterQueueConcurrencyUseCase);
    #updateRole = container.resolve(UpdateTeamClusterRoleUseCase);

    create(input: UseCaseInput<CreateTeamClusterUseCase>): Promise<UseCaseOutput<CreateTeamClusterUseCase>> {
        return this.#createTeamCluster.execute(input);
    }

    listByTeamId(input: UseCaseInput<ListTeamClustersByTeamIdUseCase>): Promise<UseCaseOutput<ListTeamClustersByTeamIdUseCase>> {
        return this.#listByTeamId.execute(input);
    }

    provisionDemo(input: UseCaseInput<ProvisionDemoTeamClusterUseCase>): Promise<UseCaseOutput<ProvisionDemoTeamClusterUseCase>> {
        return this.#provisionDemo.execute(input);
    }

    deleteDemo(input: UseCaseInput<DeleteDemoTeamClusterUseCase>): Promise<UseCaseOutput<DeleteDemoTeamClusterUseCase>> {
        return this.#deleteDemo.execute(input);
    }

    getDemoStatus(input: UseCaseInput<GetDemoTeamClusterStatusUseCase>): Promise<UseCaseOutput<GetDemoTeamClusterStatusUseCase>> {
        return this.#getDemoStatus.execute(input);
    }

    getById(input: UseCaseInput<GetTeamClusterByIdUseCase>): Promise<UseCaseOutput<GetTeamClusterByIdUseCase>> {
        return this.#getById.execute(input);
    }

    getRuntimeSnapshot(input: UseCaseInput<GetTeamClusterRuntimeSnapshotUseCase>): Promise<UseCaseOutput<GetTeamClusterRuntimeSnapshotUseCase>> {
        return this.#getRuntimeSnapshot.execute(input);
    }

    updateQueueConcurrency(input: UseCaseInput<UpdateTeamClusterQueueConcurrencyUseCase>): Promise<UseCaseOutput<UpdateTeamClusterQueueConcurrencyUseCase>> {
        return this.#updateQueueConcurrency.execute(input);
    }

    updateRole(input: UseCaseInput<UpdateTeamClusterRoleUseCase>): Promise<UseCaseOutput<UpdateTeamClusterRoleUseCase>> {
        return this.#updateRole.execute(input);
    }

    listTransferJobs(input: UseCaseInput<ListTeamClusterTransferJobsUseCase>): Promise<UseCaseOutput<ListTeamClusterTransferJobsUseCase>> {
        return this.#listTransferJobs.execute(input);
    }

    createTransferRequest(input: UseCaseInput<CreateTeamClusterTransferRequestUseCase>): Promise<UseCaseOutput<CreateTeamClusterTransferRequestUseCase>> {
        return this.#createTransferRequest.execute(input);
    }

    getResourceLimits(input: UseCaseInput<GetClusterResourceLimitsUseCase>): Promise<UseCaseOutput<GetClusterResourceLimitsUseCase>> {
        return this.#getResourceLimits.execute(input);
    }

    revealCredentials(input: UseCaseInput<RevealTeamClusterCredentialsUseCase>): Promise<UseCaseOutput<RevealTeamClusterCredentialsUseCase>> {
        return this.#revealCredentials.execute(input);
    }

    createRemoteAccessSession(input: UseCaseInput<CreateTeamClusterRemoteAccessSessionUseCase>): Promise<UseCaseOutput<CreateTeamClusterRemoteAccessSessionUseCase>> {
        return this.#createRemoteAccessSession.execute(input);
    }

    listRemoteExplorerEntries(input: UseCaseInput<ListTeamClusterRemoteExplorerEntriesUseCase>): Promise<UseCaseOutput<ListTeamClusterRemoteExplorerEntriesUseCase>> {
        return this.#listRemoteExplorerEntries.execute(input);
    }

    getRemoteExplorerNode(input: UseCaseInput<GetTeamClusterRemoteExplorerNodeUseCase>): Promise<UseCaseOutput<GetTeamClusterRemoteExplorerNodeUseCase>> {
        return this.#getRemoteExplorerNode.execute(input);
    }

    downloadRemoteExplorerObject(input: UseCaseInput<DownloadTeamClusterRemoteExplorerObjectUseCase>): Promise<UseCaseOutput<DownloadTeamClusterRemoteExplorerObjectUseCase>> {
        return this.#downloadRemoteExplorerObject.execute(input);
    }

    regenerateEnrollmentToken(input: UseCaseInput<RegenerateTeamClusterEnrollmentTokenUseCase>): Promise<UseCaseOutput<RegenerateTeamClusterEnrollmentTokenUseCase>> {
        return this.#regenerateEnrollmentToken.execute(input);
    }

    deleteById(input: UseCaseInput<DeleteTeamClusterByIdUseCase>): Promise<UseCaseOutput<DeleteTeamClusterByIdUseCase>> {
        return this.#deleteById.execute(input);
    }

    processHealthcheck(input: UseCaseInput<ProcessTeamClusterHealthcheckUseCase>): Promise<UseCaseOutput<ProcessTeamClusterHealthcheckUseCase>> {
        return this.#processHealthcheck.execute(input);
    }

    generateInstallManifest(input: UseCaseInput<GenerateTeamClusterInstallManifestUseCase>): Promise<UseCaseOutput<GenerateTeamClusterInstallManifestUseCase>> {
        return this.#generateInstallManifest.execute(input);
    }
}
