import { Graph as GraphlibGraph, alg as graphlibAlgorithms, type Edge as GraphlibEdge } from '@dagrejs/graphlib';
import type { ProcessExecutionLogSink } from '@/core/runtime/contracts/execution-log';
import type { BinaryExecutorService } from '@/core/runtime/infrastructure/binary-executor-service';
import type { PluginBinaryCache } from '@/modules/plugin/application/binaries/PluginBinaryCache';
import type { ArtifactUploadBatch } from '@/modules/plugin/contracts/artifact-upload';
import type { ResultProcessorService } from '@/modules/plugin/application/exports/result-processor-service-contract';
import type { WorkflowExposureInspectionResult } from '@/modules/analysis/application/workflow/exposure-payload-reader';
import type { TrajectoryFrameStore } from '@/modules/trajectory/application/storage/TrajectoryFrameStore';

import type { AnalysisJobExecutionData, DaemonAnalysisDocument } from './http-analysis';
import type {
    TrajectoryDumpDescriptor,
    TrajectoryFrame,
    WorkflowDefinition,
    WorkflowEdgeDefinition,
    WorkflowNodeData
} from './http-workflow';

export interface WorkflowNodePosition {
    x: number;
    y: number;
}

export interface WorkflowNode {
    id: string;
    type: WorkflowNodeType;
    position: WorkflowNodePosition;
    data: WorkflowNodeData;
}

export type WorkflowEdge = WorkflowEdgeDefinition

// Intentionally permissive (`object` lets domain objects like
// `PluginExecutionOutput` flow through `WorkflowNodeOutput`). Narrower
// JSON-only flavours live in `support/types/json.ts`.
export type WorkflowValue =
    | boolean
    | null
    | number
    | object
    | string
    | undefined

export interface WorkflowValueMap {
    [key: string]: WorkflowValue;
}

export type WorkflowNodeOutput = WorkflowValueMap;

export interface WorkflowEntrypointConfigDefaults {
    binaryObjectPath?: string;
    argumentsTemplate?: string;
    entrypointType?: import('@/core/runtime/contracts/http-runtime').EntrypointType;
    requirementsFile?: string;
    entrypointScript?: string;
}

export interface WorkflowPreparedEntrypointArgs {
    args: string[];
    release?: () => void;
}

export interface WorkflowEntrypointExecutionOptions {
    defaults?: WorkflowEntrypointConfigDefaults;
    jobId: string;
    outputDir: string;
    pluginBinaryCache: PluginBinaryCache;
    binaryExecutorService: BinaryExecutorService;
    // Why: optional dependencies enabling the persistent Python pool path.
    // When both frame store + cluster id are present and the entrypoint is a
    // Python/packaged plugin, the handler routes through the pool + result
    // cache + shared-memory bridge; otherwise it falls back to the legacy
    // one-shot spawn.
    trajectoryFrameStore?: TrajectoryFrameStore;
    ownerClusterId?: string;
    logSink?: ProcessExecutionLogSink;
    prepareArgs?: (args: string[]) => WorkflowPreparedEntrypointArgs;
    restoreOutputOnError?: boolean;
    includeOutputFiles?: boolean;
    extraOutput?: WorkflowNodeOutput;
    nonZeroExitMessage?: string | ((result: Awaited<ReturnType<BinaryExecutorService['executeProcess']>>) => string);
    requireNonEmptyArguments?: boolean;
    requireEntrypointType?: boolean;
    missingTypeMessage?: string;
    errorMessage?: string;
}

export interface WorkflowExposureExecutionOptions {
    mode: 'runtime' | 'debug' | 'inline';
    outputDir: string;
    executionData?: AnalysisJobExecutionData;
    timestep?: number;
    artifactUploadBatch?: ArtifactUploadBatch;
    resultProcessor?: ResultProcessorService;
    onInspection?: (nodeId: string, inspection: WorkflowExposureInspectionResult) => void;
}

export interface WorkflowExecutionOptions {
    entrypoint?: WorkflowEntrypointExecutionOptions;
    exposure?: WorkflowExposureExecutionOptions;
}

export type WorkflowOutputs = Map<string, WorkflowNodeOutput>

export interface WorkflowExecutionContext {
    outputs: WorkflowOutputs;
    userConfig: WorkflowValueMap;
    runtimeArguments: WorkflowValueMap;
    trajectoryId: string;
    trajectoryFrames: TrajectoryFrame[];
    trajectoryDumpOverrides?: TrajectoryDumpDescriptor[];
    analysis: DaemonAnalysisDocument;
    analysisId: string;
    generatedFiles: string[];
    pluginId: string;
    teamId: string;
    selectedFrameOnly?: boolean;
    selectedTimesteps?: number[];
    selectedTimestep?: number;
    workflow: WorkflowGraph;
    nestedWorkflows: Map<string, WorkflowDefinition>;
    execution?: WorkflowExecutionOptions;
}

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

export const matchesIfBranchHandle = (
    edgeHandle: string | undefined,
    selectedBranch: string
): boolean => {
    if (selectedBranch === 'true') {
        return edgeHandle === 'output-true' || edgeHandle === 'true';
    }

    return edgeHandle === 'output-false' || edgeHandle === 'false';
};

export class WorkflowGraph {
    private readonly graph: GraphlibGraph<undefined, WorkflowNode, WorkflowEdge>;

    constructor(public readonly definition: WorkflowDefinition) {
        this.graph = new GraphlibGraph({
            directed: true,
            multigraph: true
        });

        for (const node of this.nodes) {
            this.graph.setNode(node.id, node);
        }

        for (const [index, edge] of this.edges.entries()) {
            if (!this.graph.hasNode(edge.source) || !this.graph.hasNode(edge.target)) {
                continue;
            }

            this.graph.setEdge(edge.source, edge.target, edge, `edge:${index}`);
        }
    }

    get nodes(): WorkflowNode[] {
        return this.definition.nodes as WorkflowNode[];
    }

    get edges(): WorkflowEdge[] {
        return this.definition.edges as WorkflowEdge[];
    }

    getNode(nodeId: string): WorkflowNode | null {
        return this.graph.hasNode(nodeId)
            ? this.graph.node(nodeId) ?? null
            : null;
    }

    getParentEdges(nodeId: string): WorkflowEdge[] {
        return this.toWorkflowEdges(this.graph.inEdges(nodeId));
    }

    getChildEdges(nodeId: string, sourceHandle?: string): WorkflowEdge[] {
        return this.toWorkflowEdges(this.graph.outEdges(nodeId))
            .filter((edge) => sourceHandle === undefined || edge.sourceHandle === sourceHandle);
    }

    getChildren(nodeId: string, sourceHandle?: string): WorkflowNode[] {
        return this.getChildEdges(nodeId, sourceHandle)
            .map((edge) => this.getNode(edge.target))
            .filter((node): node is WorkflowNode => node !== null);
    }

    getChildNodeIds(nodeId: string, sourceHandle?: string): string[] {
        return this.getChildEdges(nodeId, sourceHandle)
            .map((edge) => edge.target);
    }

    getRootNodes(): WorkflowNode[] {
        return this.nodes.filter((node) => this.getParentEdges(node.id).length === 0);
    }

    getRootNodeIds(): string[] {
        return this.getRootNodes().map((node) => node.id);
    }

    getIfBranchChildNodeIds(nodeId: string, branch: 'true' | 'false'): string[] {
        return this.getChildEdges(nodeId)
            .filter((edge) => matchesIfBranchHandle(edge.sourceHandle, branch))
            .map((edge) => edge.target);
    }

    getIfInactiveBranchChildNodeIds(nodeId: string, branch: 'true' | 'false'): string[] {
        const activeNodeIds = new Set(this.getIfBranchChildNodeIds(nodeId, branch));

        return this.getChildNodeIds(nodeId)
            .filter((childNodeId) => !activeNodeIds.has(childNodeId));
    }

    getSwitchChildNodeIds(nodeId: string, matchedCaseId: string | null): {
        activeNodeIds: string[];
        inactiveNodeIds: string[];
    } {
        const continueNodeIds = this.getChildNodeIds(nodeId, 'continue');
        const caseNodeIds = this.getChildNodeIds(nodeId, 'cases');
        const matchedNodeIds = matchedCaseId
            ? caseNodeIds.filter((childNodeId) => childNodeId === matchedCaseId)
            : [];

        return {
            activeNodeIds: [...matchedNodeIds, ...continueNodeIds],
            inactiveNodeIds: caseNodeIds.filter((childNodeId) => childNodeId !== matchedCaseId)
        };
    }

    getRuntimeRootNodes(): WorkflowNode[] {
        for (const type of [WorkflowNodeType.ForEach, WorkflowNodeType.Context, WorkflowNodeType.Arguments, WorkflowNodeType.Modifier]) {
            const runtimeRootNode = this.nodes.find((node) => node.type === type);

            if (runtimeRootNode) {
                return this.getChildren(runtimeRootNode.id);
            }
        }

        return [];
    }

    getRuntimeStartNodes(): WorkflowNode[] {
        const runtimeRootNodes = this.getRuntimeRootNodes();

        return runtimeRootNodes.length > 0
            ? runtimeRootNodes
            : this.nodes.filter((node) => node.type === WorkflowNodeType.Entrypoint);
    }

    findAncestorByType(nodeId: string, type: WorkflowNodeType): WorkflowNode | null {
        const visited = new Set<string>();
        const queue = [nodeId];

        while (queue.length > 0) {
            const currentId = queue.shift();
            if (!currentId) {
                continue;
            }

            if (visited.has(currentId)) {
                continue;
            }
            visited.add(currentId);

            for (const parentNodeId of this.graph.predecessors(currentId) ?? []) {
                const parentNode = this.getNode(parentNodeId);
                if (parentNode?.type === type) {
                    return parentNode;
                }
                queue.push(parentNodeId);
            }
        }

        return null;
    }

    findDescendantByType(nodeId: string, type: WorkflowNodeType): WorkflowNode | null {
        const visited = new Set<string>();
        const queue = [nodeId];

        while (queue.length > 0) {
            const currentId = queue.shift();
            if (!currentId) {
                continue;
            }

            if (visited.has(currentId)) {
                continue;
            }
            visited.add(currentId);

            for (const childNodeId of this.graph.successors(currentId) ?? []) {
                const childNode = this.getNode(childNodeId);
                if (!childNode) {
                    continue;
                }

                if (childNode.type === type) {
                    return childNode;
                }

                queue.push(childNode.id);
            }
        }

        return null;
    }

    topologicalSort(): WorkflowNode[] {
        return graphlibAlgorithms.topsort(this.graph)
            .map((nodeId) => this.getNode(nodeId))
            .filter((node): node is WorkflowNode => node !== null);
    }

    private toWorkflowEdges(edges: readonly GraphlibEdge[] | void): WorkflowEdge[] {
        if (!edges) {
            return [];
        }

        return edges
            .map((edge) => this.graph.edge(edge))
            .filter((workflowEdge): workflowEdge is WorkflowEdge => workflowEdge !== undefined);
    }
};
