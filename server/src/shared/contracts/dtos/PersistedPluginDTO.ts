/**
 * Neutral, cross-module persisted-plugin DTO contract.
 * Extracted from `@modules/plugin/application/dtos/plugin/PersistedPluginDTO`
 * during the detachable-modules migration. The plugin props / workflow-props
 * shapes are not part of the neutral contracts layer, so this DTO is GENERIC
 * over them; the owner module re-exports a bound alias so existing importers
 * (and `extends PersistedPluginDTO` declarations) compile unchanged.
 *
 * Pure type — no runtime footprint, no `@modules/*` import.
 */
export type PersistedPluginDTO<TPluginProps = unknown, TWorkflowProps = unknown> =
    Omit<TPluginProps, 'workflow'> & {
        _id: string;
        workflow: TWorkflowProps;
    };
