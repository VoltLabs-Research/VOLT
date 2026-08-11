import { WorkflowGraph, WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import type { WorkflowEdge, WorkflowNode, WorkflowNodeOutput, WorkflowOutputs } from '@shared/contracts/types/workflow.types';

export type WorkflowExecutionStatus = 'executed' | 'pending' | 'failed' | 'skipped';

/**
 * How a node — or the edge that reaches it — stands relative to the run: `active`
 * usable, `inactive` on a branch that was not taken, `unresolved` still waiting on
 * a parent, `failed` reachable but poisoned by its parent.
 */
type WorkflowRuntimeNodeState = 'active' | 'inactive' | 'unresolved' | 'failed';

interface WorkflowEdgeResolution {
    state: WorkflowRuntimeNodeState;
    reason?: string;
}

/** Memoises node states for one traversal, and detects cycles while doing it. */
interface WorkflowResolutionCache {
    stateByNodeId: Map<string, WorkflowRuntimeNodeState>;
    resolvingNodeIds: Set<string>;
}

interface WorkflowSchedulerParams {
    workflow: WorkflowGraph;
    outputs: WorkflowOutputs;
    getNodeExecutionStatus: (nodeId: string) => WorkflowExecutionStatus;
}

const readIfBranch = (output: WorkflowNodeOutput, nodeId: string): 'true' | 'false' => {
    if (output.branch === 'true' || output.branch === 'false') {
        return output.branch;
    }

    throw new Error(`IfStatement node "${nodeId}" produced an invalid branch result`);
};

const readMatchedCaseId = (output: WorkflowNodeOutput): string | null =>
    typeof output.matchedCaseId === 'string' ? output.matchedCaseId : null;

const activeUnless = (isActive: boolean, reason: string): WorkflowEdgeResolution =>
    isActive ? { state: 'active' } : {
 state: 'inactive', reason 
};

export class WorkflowScheduler {
    static forVisitedNodes(
        workflow: WorkflowGraph,
        outputs: WorkflowOutputs,
        visitedNodeIds: Set<string>
    ): WorkflowScheduler {
        return new WorkflowScheduler({
            workflow,
            outputs,
            getNodeExecutionStatus: (nodeId) => visitedNodeIds.has(nodeId) ? 'executed' : 'pending'
        });
    }

    constructor(private readonly params: WorkflowSchedulerParams) {}

    areParentEdgesResolved(nodeId: string): boolean {
        const cache = this.createCache();

        return this.params.workflow.getParentEdges(nodeId)
            .every((edge) => this.resolveEdge(edge, nodeId, cache).state !== 'unresolved');
    }

    isNodeReady(nodeId: string): boolean {
        const parentEdges = this.params.workflow.getParentEdges(nodeId);
        if (parentEdges.length === 0) {
            return true;
        }

        const cache = this.createCache();
        let hasActiveParent = false;

        for (const edge of parentEdges) {
            const { state } = this.resolveEdge(edge, nodeId, cache);
            if (state === 'unresolved') {
                return false;
            }

            hasActiveParent ||= state !== 'inactive';
        }

        return hasActiveParent;
    }

    getSkipReason(node: WorkflowNode): string | undefined {
        const cache = this.createCache();
        let hasActiveParent = false;
        let inactiveReason: string | undefined;

        for (const parentEdge of this.params.workflow.getParentEdges(node.id)) {
            const { state, reason } = this.resolveEdge(parentEdge, node.id, cache);
            if (state === 'unresolved' || state === 'failed') {
                return reason;
            }

            if (state === 'active') {
                hasActiveParent = true;
                continue;
            }

            inactiveReason ??= reason;
        }

        return hasActiveParent ? undefined : inactiveReason;
    }

    resolveChildNodeIds(node: WorkflowNode, output: WorkflowNodeOutput): {
        activeNodeIds: string[];
        inactiveNodeIds: string[];
    } {
        const { workflow } = this.params;

        if (node.type === WorkflowNodeType.IfStatement) {
            const branch = readIfBranch(output, node.id);

            return {
                activeNodeIds: workflow.getIfBranchChildNodeIds(node.id, branch),
                inactiveNodeIds: workflow.getIfInactiveBranchChildNodeIds(node.id, branch)
            };
        }

        if (node.type === WorkflowNodeType.SwitchStatement) {
            return workflow.getSwitchChildNodeIds(node.id, readMatchedCaseId(output));
        }

        return {
            activeNodeIds: workflow.getChildNodeIds(node.id),
            inactiveNodeIds: []
        };
    }

    private createCache(): WorkflowResolutionCache {
        return {
            stateByNodeId: new Map<string, WorkflowRuntimeNodeState>(),
            resolvingNodeIds: new Set<string>()
        };
    }

    private resolveNodeState(nodeId: string, cache: WorkflowResolutionCache): WorkflowRuntimeNodeState {
        const cachedState = cache.stateByNodeId.get(nodeId);
        if (cachedState) {
            return cachedState;
        }

        if (cache.resolvingNodeIds.has(nodeId)) {
            throw new Error(`Workflow contains a cycle near node "${nodeId}"`);
        }

        cache.resolvingNodeIds.add(nodeId);
        const nodeState = this.computeNodeState(nodeId, cache);
        cache.stateByNodeId.set(nodeId, nodeState);
        cache.resolvingNodeIds.delete(nodeId);

        return nodeState;
    }

    /** A node inherits `inactive`/`unresolved`/`failed` from its parents; only a reachable node gets judged on its own status. */
    private computeNodeState(nodeId: string, cache: WorkflowResolutionCache): WorkflowRuntimeNodeState {
        const parentEdges = this.params.workflow.getParentEdges(nodeId);
        const parentStates = new Set(parentEdges.map((edge) => this.resolveEdge(edge, nodeId, cache).state));

        if (parentEdges.length > 0 && !parentStates.has('active')) {
            if (parentStates.has('unresolved')) {
                return 'unresolved';
            }

            return parentStates.has('failed') ? 'failed' : 'inactive';
        }

        const nodeStatus = this.params.getNodeExecutionStatus(nodeId);
        if (nodeStatus === 'executed') {
            return 'active';
        }

        return nodeStatus === 'pending' ? 'unresolved' : 'failed';
    }

    /** Classifies one inbound edge: first by how its source stands, then by the branch it sits on. */
    private resolveEdge(
        edge: WorkflowEdge,
        targetNodeId: string,
        cache: WorkflowResolutionCache
    ): WorkflowEdgeResolution {
        const parentState = this.resolveNodeState(edge.source, cache);

        if (parentState === 'active') {
            return this.resolveBranchEdge(edge, targetNodeId);
        }

        if (parentState === 'inactive') {
            return { state: 'inactive' };
        }

        if (parentState === 'unresolved') {
            return {
                state: 'unresolved',
                reason: `Parent node "${edge.source}" has not executed`
            };
        }

        return {
            state: 'failed',
            reason: this.params.getNodeExecutionStatus(edge.source) === 'failed'
                ? `Parent node "${edge.source}" failed`
                : `Parent node "${edge.source}" was skipped`
        };
    }

    /** Decides whether an executed parent actually hands control to this particular child. */
    private resolveBranchEdge(edge: WorkflowEdge, targetNodeId: string): WorkflowEdgeResolution {
        const { workflow, outputs } = this.params;
        const parentNode = workflow.getNode(edge.source);
        if (!parentNode) {
            return { state: 'inactive' };
        }

        const parentOutput = outputs.get(parentNode.id) ?? {};

        if (parentNode.type === WorkflowNodeType.ForEach) {
            const itemCount = typeof parentOutput.count === 'number'
                ? parentOutput.count
                : Array.isArray(parentOutput.items) ? parentOutput.items.length : 0;

            return activeUnless(itemCount > 0, `ForEach node "${parentNode.id}" produced no items`);
        }

        if (parentNode.type === WorkflowNodeType.IfStatement) {
            const branch = readIfBranch(parentOutput, parentNode.id);

            return activeUnless(
                workflow.getIfBranchChildNodeIds(parentNode.id, branch).includes(targetNodeId),
                `Node "${targetNodeId}" is not on the selected "${branch}" branch`
            );
        }

        if (parentNode.type === WorkflowNodeType.SwitchStatement) {
            const matchedCaseId = readMatchedCaseId(parentOutput);

            return activeUnless(
                edge.sourceHandle === 'continue'
                    || (edge.sourceHandle === 'cases' && matchedCaseId === targetNodeId),
                matchedCaseId
                    ? `Switch statement "${parentNode.id}" selected case "${matchedCaseId}"`
                    : `Switch statement "${parentNode.id}" did not match this case`
            );
        }

        return { state: 'active' };
    }
}
