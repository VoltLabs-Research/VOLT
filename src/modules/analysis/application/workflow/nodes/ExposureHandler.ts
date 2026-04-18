import type { AnalysisExposureDefinition } from '@/modules/analysis/contracts/http-analysis';
import type { WorkflowNodeHandler } from '@/modules/analysis/application/workflow/NodeRegistry';
import {
    createWorkflowExposureOutputFilePath,
    inspectWorkflowExposureOutput
} from '@/modules/analysis/application/workflow/exposure-payload-reader';
import type {
    WorkflowExecutionContext,
    WorkflowExposureExecutionOptions,
    WorkflowNode,
    WorkflowNodeOutput
} from '@/modules/analysis/contracts/workflow.types';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import fs from 'node:fs/promises';

export class WorkflowExposureHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Exposure;

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

        const exportNode = context.workflow.findDescendantByType(node.id, WorkflowNodeType.Export);

        return {
            nodeId: node.id,
            name: exposureData.name ?? node.id,
            results: exposureData.results ?? '',
            iterable: exposureData.iterable,
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
            execution.artifactUploadBatch
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

        const linkedExportNodeId = context.workflow.findDescendantByType(node.id, WorkflowNodeType.Export)?.id;

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
