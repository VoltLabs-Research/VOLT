import { inspectWorkflowExposureOutput } from '@modules/analysis/services/workflow/exposure-payload-reader';
import { processExportNode } from '@modules/plugin/services/exports/ExportNodeProcessor';
import { createDebugArtifactBatch } from '@modules/analysis/services/workflow/debug/debug-artifact-batch';
import type { WorkflowNode } from '@shared/contracts/types/workflow.types';
import type { DebugEnvironmentState } from '@modules/analysis/services/workflow/debug/DebugEnvironment';
import type { DebugSession, NodeExecutionOutcome } from '@modules/analysis/services/workflow/debug/debug-session';

export const executeDebugExportNode = async (
    session: DebugSession,
    node: WorkflowNode,
    preparedExecution: DebugEnvironmentState
): Promise<NodeExecutionOutcome> => {
    const exposureNodeId = session.exportNodeToExposureNodeId.get(node.id);
    if (!exposureNodeId) {
        return {
            status: 'skipped',
            reason: `Export node ${node.id} is not linked to an exposure node`
        };
    }

    const exposure = session.exposuresByNodeId.get(exposureNodeId);
    if (!exposure?.export) {
        return {
            status: 'skipped',
            reason: `Export node ${node.id} has no valid export configuration`
        };
    }

    let inspection = session.exposureCache.get(exposureNodeId);
    if (!inspection) {
        if (!exposure.results) {
            return {
                status: 'skipped',
                reason: `Exposure ${exposureNodeId} has no results file configured`
            };
        }

        inspection = await inspectWorkflowExposureOutput(preparedExecution.outputDir, exposure.results);
        session.exposureCache.set(exposureNodeId, inspection);
    }

    if (!inspection.exportPayload) {
        return {
            status: 'skipped',
            reason: `Exposure ${exposureNodeId} did not produce export payload data`
        };
    }

    const { storageClusterId } = session;
    const artifactBatch = createDebugArtifactBatch(
        `${preparedExecution.outputDir}_debug_export_${node.id}_${Date.now()}`
    );

    await processExportNode({
        executionData: {
            analysisId: session.context.analysisId,
            trajectoryId: session.context.trajectoryId,
            pluginId: session.context.pluginId,
            storageClusterId
        },
        exposure,
        decodedPayload: inspection.exportPayload,
        outputFilePath: inspection.outputFilePath,
        timestep: session.context.selectedTimestep ?? preparedExecution.selectedDump.timestep,
        storageClusterId,
        artifactUploadBatch: artifactBatch
    });

    return {
        status: 'executed',
        output: {
            artifacts: artifactBatch.getArtifacts().map((artifact) => ({
                path: artifact.path,
                objectKey: artifact.objectKey,
                bucket: artifact.bucket,
                contentType: artifact.contentType,
                fileName: artifact.fileName
            })),
            exporter: exposure.export.exporter,
            exportType: exposure.export.type,
            sourceExposureNodeId: exposureNodeId
        }
    };
};
