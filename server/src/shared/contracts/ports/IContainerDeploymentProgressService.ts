/**
 * Neutral, cross-module port for the container deployment-progress emitter — it
 * fans container-create runtime progress events from a connected daemon out to
 * the owning team's room. Scoped to the surface consumed OUTSIDE the container
 * module: the cluster reverse-channel service forwards daemon `container-create`
 * runtime-progress payloads through `emitToTeam`.
 *
 * Extracted during the detachable-modules migration so the cluster module can
 * stop importing the concrete `@modules/container` service. The concrete
 * `ContainerDeploymentProgressService` stays in the container module, registered
 * under `CONTAINER_CONTRACT_TOKENS.ContainerDeploymentProgressService`; the
 * cluster consumer `@inject(...)`s against this port without importing
 * `@modules/container`.
 *
 * This file imports no `@modules/*` code — pure data/types only.
 */
export interface ContainerDeploymentProgressInput {
    operationId: string;
    teamClusterId: string;
    stage: string;
    step?: string;
    image?: string;
    containerName?: string;
    containerId?: string;
    timestamp: string;
}

export interface IContainerDeploymentProgressService {
    emitToTeam(input: ContainerDeploymentProgressInput): Promise<void>;
}
