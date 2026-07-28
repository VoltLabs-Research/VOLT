import type { AnalysisExposureDefinition } from '@shared/contracts/types/http-analysis';
import { WORKFLOW_NODE_PHASE, type WorkflowNodeHandler } from '@modules/analysis/services/workflow/NodeRegistry';
import {
    createWorkflowExposureOutputFilePath,
    inspectWorkflowExposureOutput
} from '@modules/analysis/services/workflow/exposure-payload-reader';
import type {
    WorkflowExecutionContext,
    WorkflowExposureExecutionOptions,
    WorkflowNode,
    WorkflowNodeOutput
} from '@shared/contracts/types/workflow.types';
import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import type { WorkflowGraph } from '@shared/contracts/types/workflow.types';
import fs from 'node:fs/promises';

const exportDescendantCache = new WeakMap<WorkflowGraph, Map<string, WorkflowNode | null>>();

const resolveExportDescendant = (workflow: WorkflowGraph, nodeId: string): WorkflowNode | null => {
    let cache = exportDescendantCache.get(workflow);
    if (!cache) {
        cache = new Map();
        exportDescendantCache.set(workflow, cache);
    }

    if (cache.has(nodeId)) {
        return cache.get(nodeId) ?? null;
    }

    const exportNode = workflow.findDescendantByType(nodeId, WorkflowNodeType.Export);
    cache.set(nodeId, exportNode);
    return exportNode;
};

export class WorkflowExposureHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Exposure;
    readonly phase = WORKFLOW_NODE_PHASE[WorkflowNodeType.Exposure];

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowNodeOutput> {
        const execution = context.execution?.exposure;
        if (!execution) {
            throw new Error(`Exposure ${node.id} cannot be executed without workflow execution context`);
        }

        const exposure = this.resolveExposureDefinition(node, context);
        if (!exposure) {
            return this.createSkippedOutput(`Exposure node ${node.id} has no exposure configuration`);
        }

        if (!exposure.results) {
            return this.createSkippedOutput(`Exposure node ${node.id} has no configured results file`);
        }

        switch (execution.mode) {
            case 'runtime':
                return this.executeRuntimeExposure(context, execution, exposure);
            case 'debug':
                return this.executeDebugExposure(node, context, execution, exposure);
            case 'inline':
                return this.executeInlineExposure(node, execution, exposure);
        }
    }

    private resolveExposureDefinition(
        node: WorkflowNode,
        context: WorkflowExecutionContext
    ): AnalysisExposureDefinition | null {
        const exposureData = node.data.exposure;
        if (!exposureData) {
            return null;
        }

        const exportNode = resolveExportDescendant(context.workflow, node.id);

        return {
            nodeId: node.id,
            name: exposureData.name ?? node.id,
            results: exposureData.results ?? '',
            id: exposureData.id,
            export: exportNode?.data.export
        };
    }

    private async executeRuntimeExposure(
        context: WorkflowExecutionContext,
        execution: WorkflowExposureExecutionOptions,
        exposure: AnalysisExposureDefinition
    ): Promise<WorkflowNodeOutput> {
        if (
            !execution.executionData
            || execution.timestep === undefined
            || !execution.artifactUploadBatch
            || !execution.resultProcessor
        ) {
            throw new Error(`Exposure ${exposure.nodeId} is missing runtime processing dependencies`);
        }

        await execution.resultProcessor.processExposureResult(
            execution.executionData,
            exposure,
            execution.outputDir,
            execution.timestep,
            context.teamId,
            execution.artifactUploadBatch,
            execution.stageReporter
        );

        return {
            processed: true,
            results: exposure.results,
            outputFilePath: createWorkflowExposureOutputFilePath(execution.outputDir, exposure.results)
        };
    }

    private async executeDebugExposure(
        node: WorkflowNode,
        context: WorkflowExecutionContext,
        execution: WorkflowExposureExecutionOptions,
        exposure: AnalysisExposureDefinition
    ): Promise<WorkflowNodeOutput> {
        const inspection = await inspectWorkflowExposureOutput(execution.outputDir, exposure.results);
        execution.onInspection?.(node.id, inspection);

        const linkedExportNodeId = resolveExportDescendant(context.workflow, node.id)?.id;

        return {
            outputFilePath: inspection.outputFilePath,
            listingRowCount: inspection.listingRowCount,
            subListingNames: inspection.subListingNames,
            hasExportPayload: inspection.exportPayload !== null,
            linkedExportNodeId
        };
    }

    private async executeInlineExposure(
        node: WorkflowNode,
        execution: WorkflowExposureExecutionOptions,
        exposure: AnalysisExposureDefinition
    ): Promise<WorkflowNodeOutput> {
        const filePath = createWorkflowExposureOutputFilePath(execution.outputDir, exposure.results);

        try {
            await fs.access(filePath);
        } catch {
            return this.createSkippedOutput(
                `Exposure output ${exposure.results} was not generated for node ${node.id}`
            );
        }

        return {
            exposureId: node.id,
            name: exposure.name,
            results: exposure.results,
            filePath
        };
    }

    private createSkippedOutput(reason: string): WorkflowNodeOutput {
        return {
            processed: false,
            skipped: true,
            reason
        };
    }
}
