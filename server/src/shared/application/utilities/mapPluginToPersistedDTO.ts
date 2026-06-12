import type { PersistedPluginDTO } from '@shared/contracts/dtos/PersistedPluginDTO';

/**
 * Neutral mapper from a persisted plugin entity to its DTO.
 *
 * Lives in the shared layer (detachable-modules migration) so cross-module
 * consumers (e.g. dashboard global-search) can map plugins without importing the
 * concrete `@modules/plugin` `Plugin` entity class. It reads only plain
 * properties (`_id`, `props`, `props.workflow.props`), so it is generic over the
 * structural shape — the concrete `Plugin` entity satisfies it, and the plugin
 * module re-exports a `Plugin`-typed binding for its internal callers.
 */
export const mapPluginToPersistedDTO = <
    TWorkflowProps,
    TProps extends { workflow: { props: TWorkflowProps } }
>(plugin: { _id: string; props: TProps }): PersistedPluginDTO<TProps, TWorkflowProps> => {
    return {
        ...plugin.props,
        _id: plugin._id,
        workflow: plugin.props.workflow.props
    } as PersistedPluginDTO<TProps, TWorkflowProps>;
};
