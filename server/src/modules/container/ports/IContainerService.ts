/**
 * The canonical definitions now live in the neutral contracts layer
 * (`@shared/contracts/ports/IContainerService`) for the detachable-modules
 * migration (the cluster module consumes the terminal types). Re-exported here
 * so existing importers of this module path keep compiling unchanged.
 */
export type {
    ContainerEnvironmentVariable,
    ContainerPortMapping,
    CreateRuntimeContainerOptions,
    ContainerProcessInfo,
    ContainerStats,
    RuntimeContainerInfo,
    ContainerFileEntry,
    ContainerTerminalSize,
    ContainerTerminalStream,
    ContainerTerminalExec,
    ContainerTerminalAttachment
} from '@shared/contracts/ports/IContainerService';
