import type { AnalysisExposureDefinition, WorkflowDefinition } from '@/contracts';
import { WorkflowGraph, WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';

interface WorkflowExposureMaps {
    exposuresByNodeId: Map<string, AnalysisExposureDefinition>;
    exportNodeToExposureNodeId: Map<string, string>;
}

export const buildWorkflowExposureMaps = (
    workflowInput: WorkflowDefinition | WorkflowGraph
): WorkflowExposureMaps => {
    const workflow = workflowInput instanceof WorkflowGraph
        ? workflowInput
        : new WorkflowGraph(workflowInput);
    const exposuresByNodeId = new Map<string, AnalysisExposureDefinition>();
    const exportNodeToExposureNodeId = new Map<string, string>();

    for (const node of workflow.nodes) {
        if (node.type !== WorkflowNodeType.Exposure) {
            continue;
        }

        const exposureData = node.data.exposure!;
        const exportNode = workflow.findDescendantByType(node.id, WorkflowNodeType.Export);
        if (exportNode) {
            exportNodeToExposureNodeId.set(exportNode.id, node.id);
        }

        exposuresByNodeId.set(node.id, {
            nodeId: node.id,
            name: exposureData.name!,
            results: exposureData.results!,
            iterable: exposureData.iterable,
            export: exportNode ? exportNode.data.export : undefined
        });
    }

    return {
        exposuresByNodeId,
        exportNodeToExposureNodeId
    };
};

export const collectWorkflowExposureDefinitions = (
    workflowInput: WorkflowDefinition | WorkflowGraph
): AnalysisExposureDefinition[] => {
    const exposureDefinitions: AnalysisExposureDefinition[] = [];

    for (const exposureDefinition of buildWorkflowExposureMaps(workflowInput).exposuresByNodeId.values()) {
        exposureDefinitions.push(exposureDefinition);
    }

    return exposureDefinitions;
};
