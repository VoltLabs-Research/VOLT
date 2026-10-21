import { Graph as GraphlibGraph, alg as graphlibAlgorithms, type Edge as GraphlibEdge } from '@dagrejs/graphlib';
import type { ProcessExecutionLogSink } from '@shared/contracts/types/execution-log';
import type { BinaryExecutor, PluginRuntimeProvider } from '@shared/contracts/types/plugin-execution';
import type { ArtifactUploadBatch } from '@shared/contracts/types/artifact-upload';
import type { ResultProcessorService } from '@shared/contracts/types/result-processor-service';
import type { WorkflowExposureInspectionResult } from '@shared/contracts/types/workflow-exposure';
import type { TrajectoryFrameStore } from '@shared/contracts/types/trajectory-frame-store';
import type { AnalysisStageReporter } from '@shared/contracts/types/analysis-stage-reporter';

import type { AnalysisJobExecutionData } from '@shared/contracts/types/http-analysis';
import type { PipelineContext } from '@shared/contracts/types/pipeline-context';
import type { TrajectoryDumpDescriptor } from '@shared/contracts/types/http-workflow';
import { NodeType, type EntrypointType } from '@volt/contracts/modules/plugin/enums';
import type { IWorkflow, IWorkflowEdge, IWorkflowNode } from '@volt/contracts/modules/plugin/workflow';
import type { DaemonAnalysisDocument, TrajectoryFrame } from '@volt/contracts/modules/analysis/daemon';

export type WorkflowValue = unknown;

export interface WorkflowValueMap {
    [key: string]: WorkflowValue;
}

export type WorkflowNodeOutput = WorkflowValueMap;

interface WorkflowEntrypointConfigDefaults {
    binaryObjectPath?: string;
    ownerClusterId?: string;
    argumentsTemplate?: string;
    entrypointType?: EntrypointType;
    requirementsFile?: string;
    entrypointScript?: string;
}

export interface WorkflowEntrypointExecutionOptions {
    defaults?: WorkflowEntrypointConfigDefaults;
    jobId: string;
    outputDir: string;
    pluginBinaryCache: PluginRuntimeProvider;
    binaryExecutorService: BinaryExecutor;
    trajectoryFrameStore?: TrajectoryFrameStore;
    ownerClusterId?: string;
    logSink?: ProcessExecutionLogSink;
    restoreOutputOnError?: boolean;
    includeOutputFiles?: boolean;
    extraOutput?: WorkflowNodeOutput;
    nonZeroExitMessage?: string | ((result: Awaited<ReturnType<BinaryExecutor['executeProcess']>>) => string);
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
    stageReporter?: AnalysisStageReporter;
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
    nestedWorkflows: Map<string, IWorkflow>;
    execution?: WorkflowExecutionOptions;
    pipelineContext?: PipelineContext;
}

const matchesIfBranchHandle = (
    edgeHandle: string | undefined,
    selectedBranch: string
): boolean => {
    if (selectedBranch === 'true') {
        return edgeHandle === 'output-true';
    }

    return edgeHandle === 'output-false';
};

type WorkflowNeighborIdResolver = (nodeId: string) => string[];

export class WorkflowGraph {
    private readonly graph: GraphlibGraph<undefined, IWorkflowNode, IWorkflowEdge>;

    constructor(public readonly definition: IWorkflow) {
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

    get nodes(): IWorkflowNode[] {
        return this.definition.nodes as IWorkflowNode[];
    }

    get edges(): IWorkflowEdge[] {
        return this.definition.edges as IWorkflowEdge[];
    }

    getNode(nodeId: string): IWorkflowNode | null {
        return this.graph.hasNode(nodeId)
            ? this.graph.node(nodeId) ?? null
            : null;
    }

    getParentEdges(nodeId: string): IWorkflowEdge[] {
        return this.toWorkflowEdges(this.graph.inEdges(nodeId));
    }

    getChildEdges(nodeId: string, sourceHandle?: string): IWorkflowEdge[] {
        return this.toWorkflowEdges(this.graph.outEdges(nodeId))
            .filter((edge) => sourceHandle === undefined || edge.sourceHandle === sourceHandle);
    }

    getChildren(nodeId: string, sourceHandle?: string): IWorkflowNode[] {
        return this.getChildEdges(nodeId, sourceHandle)
            .map((edge) => this.getNode(edge.target))
            .filter((node): node is IWorkflowNode => node !== null);
    }

    getChildNodeIds(nodeId: string, sourceHandle?: string): string[] {
        return this.getChildEdges(nodeId, sourceHandle)
            .map((edge) => edge.target);
    }

    getRootNodes(): IWorkflowNode[] {
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

    getRuntimeRootNodes(): IWorkflowNode[] {
        for (const type of [NodeType.FOREACH, NodeType.CONTEXT, NodeType.ARGUMENTS, NodeType.MODIFIER]) {
            const runtimeRootNode = this.nodes.find((node) => node.type === type);

            if (runtimeRootNode) {
                return this.getChildren(runtimeRootNode.id);
            }
        }

        return [];
    }

    getRuntimeStartNodes(): IWorkflowNode[] {
        const runtimeRootNodes = this.getRuntimeRootNodes();

        return runtimeRootNodes.length > 0
            ? runtimeRootNodes
            : this.nodes.filter((node) => node.type === NodeType.ENTRYPOINT);
    }

    private findRelatedNodeByType(
        nodeId: string,
        type: NodeType,
        resolveNeighborIds: WorkflowNeighborIdResolver
    ): IWorkflowNode | null {
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

            for (const neighborId of resolveNeighborIds(currentId)) {
                const neighborNode = this.getNode(neighborId);
                if (neighborNode?.type === type) {
                    return neighborNode;
                }
                queue.push(neighborId);
            }
        }

        return null;
    }

    findAncestorByType(nodeId: string, type: NodeType): IWorkflowNode | null {
        return this.findRelatedNodeByType(
            nodeId,
            type,
            (currentId) => this.graph.predecessors(currentId) ?? []
        );
    }

    findDescendantByType(nodeId: string, type: NodeType): IWorkflowNode | null {
        return this.findRelatedNodeByType(
            nodeId,
            type,
            (currentId) => this.graph.successors(currentId) ?? []
        );
    }

    topologicalSort(): IWorkflowNode[] {
        return graphlibAlgorithms.topsort(this.graph)
            .map((nodeId) => this.getNode(nodeId))
            .filter((node): node is IWorkflowNode => node !== null);
    }

    private toWorkflowEdges(edges: readonly GraphlibEdge[] | void): IWorkflowEdge[] {
        if (!edges) {
            return [];
        }

        return edges
            .map((edge) => this.graph.edge(edge))
            .filter((workflowEdge): workflowEdge is IWorkflowEdge => workflowEdge !== undefined);
    }
};


export interface WorkflowDumpTarget {
    localPath: string;
    originalPath?: string;
    timestep: number;
    natoms: number;
    simulationCell: string;
}

interface WorkflowProcessLogContext {
    rootNodeId: string;
    nodeId: string;
    nodeType: string;
    pluginId: string;
    executionPath: string[];
    timesteps: number[];
}

export type WorkflowLogSinkFactory = (
    context: WorkflowProcessLogContext
) => ProcessExecutionLogSink | undefined;
