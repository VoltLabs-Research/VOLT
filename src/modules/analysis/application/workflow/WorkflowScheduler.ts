import { WorkflowGraph, WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowEdge, WorkflowNode, WorkflowOutputs } from '@/modules/analysis/contracts/workflow.types';

export type WorkflowExecutionStatus = 'executed' | 'pending' | 'failed' | 'skipped';

export type WorkflowRuntimeNodeState = 'active' | 'inactive' | 'unresolved' | 'failed';

export interface WorkflowParentEdgeResolution {
    resolved: boolean;
    active: boolean;
    reason?: string;
}

interface WorkflowSchedulerState {
    nodeStateCache: Map<string, WorkflowRuntimeNodeState>;
    resolvingNodeIds: Set<string>;
}

export interface WorkflowSchedulerParams {
    workflow: WorkflowGraph;
    outputs: WorkflowOutputs;
    getNodeExecutionStatus: (nodeId: string) => WorkflowExecutionStatus;
}

export class WorkflowScheduler {
    static forVisitedNodes(
        workflow: WorkflowGraph,
        outputs: WorkflowOutputs,
        visitedNodeIds: Set<string>
    ): WorkflowScheduler {
        return new WorkflowScheduler({
            workflow,
            outputs,
            getNodeExecutionStatus: (nodeId) => visitedNodeIds.has(nodeId)
                ? 'executed'
                : 'pending'
        });
    }

    constructor(private readonly params: WorkflowSchedulerParams) {}

    resolveNodeState(
        nodeId: string,
        state: WorkflowSchedulerState = this.createState()
    ): WorkflowRuntimeNodeState {
        const cachedState = state.nodeStateCache.get(nodeId);
        if (cachedState) {
            return cachedState;
        }

        if (state.resolvingNodeIds.has(nodeId)) {
            throw new Error(`Workflow contains a cycle near node "${nodeId}"`);
        }

        state.resolvingNodeIds.add(nodeId);
        const parentEdges = this.params.workflow.getParentEdges(nodeId);
        const nodeStatus = this.params.getNodeExecutionStatus(nodeId);

        if (parentEdges.length === 0) {
            const rootState: WorkflowRuntimeNodeState = nodeStatus === 'executed'
                ? 'active'
                : nodeStatus === 'failed' || nodeStatus === 'skipped'
                    ? 'failed'
                    : 'unresolved';
            state.nodeStateCache.set(nodeId, rootState);
            state.resolvingNodeIds.delete(nodeId);
            return rootState;
        }

        let hasActiveParent = false;
        let hasUnresolvedParent = false;
        let hasFailedParent = false;

        for (const edge of parentEdges) {
            const edgeState = this.resolveParentEdgeState(edge, nodeId, state);

            if (!edgeState.resolved) {
                hasUnresolvedParent = true;
                continue;
            }

            if (!edgeState.active) {
                continue;
            }

            if (edgeState.reason) {
                hasFailedParent = true;
                continue;
            }

            hasActiveParent = true;
        }

        const nodeState: WorkflowRuntimeNodeState = hasActiveParent
            ? nodeStatus === 'executed'
                ? 'active'
                : nodeStatus === 'failed' || nodeStatus === 'skipped'
                    ? 'failed'
                    : 'unresolved'
            : hasUnresolvedParent
                ? 'unresolved'
                : hasFailedParent
                    ? 'failed'
                    : 'inactive';
        state.nodeStateCache.set(nodeId, nodeState);
        state.resolvingNodeIds.delete(nodeId);

        return nodeState;
    }

    resolveParentEdgeState(
        edge: WorkflowEdge,
        targetNodeId: string,
        state: WorkflowSchedulerState = this.createState()
    ): WorkflowParentEdgeResolution {
        const parentState = this.resolveNodeState(edge.source, state);

        if (parentState === 'unresolved') {
            return {
                resolved: false,
                active: false,
                reason: `Parent node "${edge.source}" has not executed`
            };
        }

        if (parentState === 'inactive') {
            return {
                resolved: true,
                active: false
            };
        }

        if (parentState === 'failed') {
            const status = this.params.getNodeExecutionStatus(edge.source);
            return {
                resolved: true,
                active: true,
                reason: status === 'failed'
                    ? `Parent node "${edge.source}" failed`
                    : `Parent node "${edge.source}" was skipped`
            };
        }

        return this.resolveActiveParentEdgeState(edge, targetNodeId);
    }

    areParentEdgesResolved(nodeId: string): boolean {
        const state = this.createState();

        return this.params.workflow.getParentEdges(nodeId)
            .every((edge) => this.resolveParentEdgeState(edge, nodeId, state).resolved);
    }

    isNodeReady(nodeId: string): boolean {
        const parentEdges = this.params.workflow.getParentEdges(nodeId);
        if (parentEdges.length === 0) {
            return true;
        }

        const state = this.createState();
        let hasActiveParent = false;

        for (const edge of parentEdges) {
            const edgeState = this.resolveParentEdgeState(edge, nodeId, state);
            if (!edgeState.resolved) {
                return false;
            }

            if (edgeState.active) {
                hasActiveParent = true;
            }
        }

        return hasActiveParent;
    }

    getSkipReason(node: WorkflowNode): string | undefined {
        const parentEdges = this.params.workflow.getParentEdges(node.id);
        if (parentEdges.length === 0) {
            return undefined;
        }

        const state = this.createState();
        let hasActiveParent = false;
        let inactiveReason: string | undefined;

        for (const parentEdge of parentEdges) {
            const parentState = this.resolveParentEdgeState(parentEdge, node.id, state);
            if (!parentState.resolved) {
                return parentState.reason;
            }

            if (parentState.active) {
                if (parentState.reason) {
                    return parentState.reason;
                }

                hasActiveParent = true;
                continue;
            }

            inactiveReason ??= parentState.reason;
        }

        return hasActiveParent ? undefined : inactiveReason;
    }

    resolveChildNodeIds(node: WorkflowNode, output: Record<string, unknown>): {
        activeNodeIds: string[];
        inactiveNodeIds: string[];
    } {
        if (node.type === WorkflowNodeType.IfStatement) {
            const branch = WorkflowScheduler.readIfBranch(output, node.id);

            return {
                activeNodeIds: this.params.workflow.getIfBranchChildNodeIds(node.id, branch),
                inactiveNodeIds: this.params.workflow.getIfInactiveBranchChildNodeIds(node.id, branch)
            };
        }

        if (node.type === WorkflowNodeType.SwitchStatement) {
            const matchedCaseId = typeof output.matchedCaseId === 'string'
                ? output.matchedCaseId
                : null;

            return this.params.workflow.getSwitchChildNodeIds(node.id, matchedCaseId);
        }

        return {
            activeNodeIds: this.params.workflow.getChildNodeIds(node.id),
            inactiveNodeIds: []
        };
    }

    private createState(): WorkflowSchedulerState {
        return {
            nodeStateCache: new Map<string, WorkflowRuntimeNodeState>(),
            resolvingNodeIds: new Set<string>()
        };
    }

    private resolveActiveParentEdgeState(
        edge: WorkflowEdge,
        targetNodeId: string
    ): WorkflowParentEdgeResolution {
        const parentNode = this.params.workflow.getNode(edge.source);
        if (!parentNode) {
            return {
                resolved: true,
                active: false
            };
        }

        const parentOutput = this.params.outputs.get(parentNode.id) ?? {};

        if (parentNode.type === WorkflowNodeType.ForEach) {
            const itemCount = typeof parentOutput.count === 'number'
                ? parentOutput.count
                : Array.isArray(parentOutput.items)
                    ? parentOutput.items.length
                    : 0;

            return itemCount > 0
                ? {
                    resolved: true,
                    active: true
                }
                : {
                    resolved: true,
                    active: false,
                    reason: `ForEach node "${parentNode.id}" produced no items`
                };
        }

        if (parentNode.type === WorkflowNodeType.IfStatement) {
            const branch = WorkflowScheduler.readIfBranch(parentOutput, parentNode.id);
            const activeNodeIds = new Set(
                this.params.workflow.getIfBranchChildNodeIds(parentNode.id, branch)
            );

            if(activeNodeIds.has(targetNodeId)){
                return { resolved: true, active: true };
            }

            return {
                resolved: true,
                active: false,
                reason: `Node "${targetNodeId}" is not on the selected "${branch}" branch`
            };
        }

        if (parentNode.type === WorkflowNodeType.SwitchStatement) {
            if (edge.sourceHandle === 'continue') {
                return {
                    resolved: true,
                    active: true
                };
            }

            const matchedCaseId = typeof parentOutput.matchedCaseId === 'string'
                ? parentOutput.matchedCaseId
                : null;

            if(edge.sourceHandle === 'cases' && matchedCaseId === targetNodeId){
                return { resolved: true, active: true };
            }

            return {
                resolved: true,
                active: false,
                reason: matchedCaseId 
                    ? `Switch statement "${parentNode.id}" selected case "${matchedCaseId}"`
                    : `Switch statement "${parentNode.id}" did not match this case`
            };
        }

        return {
            resolved: true,
            active: true
        };
    }

    private static readIfBranch(
        output: Record<string, unknown>,
        nodeId: string
    ): 'true' | 'false' {
        if (output.branch === 'true' || output.branch === 'false') {
            return output.branch;
        }

        throw new Error(`IfStatement node "${nodeId}" produced an invalid branch result`);
    }
}
