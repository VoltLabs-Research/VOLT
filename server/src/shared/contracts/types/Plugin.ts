/**
 * Neutral, standalone STRUCTURAL contract for plugin/workflow data.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration). Lets
 * cross-module consumers (trajectory's public-canvas + atom/line services)
 * depend on the plugin/workflow shapes without importing `@modules/plugin`.
 *
 * `WorkflowNodeType` is the CANONICAL runtime enum: it has been MOVED here from
 * `@modules/plugin/domain/entities/plugin/workflow/WorkflowNode` and that owner
 * file now re-exports it, so there is a single nominal enum object shared by the
 * owner module and every consumer (string-valued, used in `node.type === ...`
 * comparisons across module boundaries — a duplicate would be nominally
 * distinct in TS, so it is moved, not copied).
 *
 * The `Plugin`/`Workflow` entities in the owner module are classes with methods
 * — they are NOT copied here. Consumers needing the data shapes use the
 * structural `*Like` / `*Props` types below (the concrete entities satisfy them
 * structurally). No `@modules/*` imports — pure data/types only.
 */

export enum WorkflowNodeType {
    Modifier = 'modifier',
    Arguments = 'arguments',
    Context = 'context',
    ForEach = 'forEach',
    Entrypoint = 'entrypoint',
    Plugin = 'plugin-node',
    Exposure = 'exposure',
    Export = 'export',
    IfStatement = 'if-statement',
    SwitchStatement = 'switch-statement',
    SwitchCase = 'switch-case'
}

/**
 * Structural stand-in for a workflow node's `data` payload. Only the fields
 * cross-module consumers read are modeled; the concrete `WorkflowNodeData`
 * (a wide all-optional record of node-kind payloads) satisfies this.
 */
export interface WorkflowNodeDataLike {
    exposure?: {
        name?: string;
        results?: string;
    };
}

/**
 * Structural stand-in for a `WorkflowNode` (the owner type carries the full
 * `WorkflowNodeData` tree). The concrete entity is assignable to this.
 */
export interface WorkflowNodeLike {
    id: string;
    type: WorkflowNodeType;
    position?: {
        x: number;
        y: number;
    };
    data?: WorkflowNodeDataLike;
}

/**
 * Structural stand-in for `WorkflowProps` (`Workflow.props`). Consumers only
 * traverse `nodes`.
 */
export interface WorkflowPropsLike {
    nodes: WorkflowNodeLike[];
}

/**
 * Structural stand-in for a computed/persisted exposure entry on a plugin
 * (`plugin.props.exposures[]`). The concrete `ComputedExposure` satisfies this.
 */
export interface PluginExposureLike {
    _id?: string;
    name?: string;
    export?: {
        exporter?: string;
        type?: string;
        options?: Record<string, unknown>;
    } | null;
}

/**
 * Structural stand-in for `PluginProps`. The owner `PluginProps` is richer
 * (extends `Partial<PluginProjection>` and carries the `Workflow` class
 * instance); this models only what cross-module consumers read. `workflow` is
 * the `{ props }` envelope because the owner stores the `Workflow` entity whose
 * `.props` holds the node graph.
 */
export interface PluginProps {
    team: string;
    status: string;
    workflow: {
        props: WorkflowPropsLike;
    };
    modifier?: {
        name?: string;
    } | null;
    exposures?: PluginExposureLike[];
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * Structural stand-in for the `Plugin` entity (a class with methods in the
 * owner module). Consumers that only need the data shape use this instead of
 * importing the concrete class.
 */
export interface PluginLike {
    _id: string;
    props: PluginProps;
}
