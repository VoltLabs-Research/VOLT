import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import fs from 'node:fs/promises';
import type { WorkflowDefinition, WorkflowExposureData } from '@/contracts';
import type { InlineExposureArtifact } from '@/modules/analysis/application/workflow/InlineWorkflowShared';

export const collectInlineExposureArtifacts = async (
    workflow: WorkflowDefinition,
    outputDir: string
): Promise<InlineExposureArtifact[]> => {
    const artifacts: InlineExposureArtifact[] = [];

    for (const node of workflow.nodes) {
        if (node.type !== WorkflowNodeType.Exposure) {
            continue;
        }

        const exposureData = node.data.exposure;
        const results = exposureData?.results || '';
        if (!results) {
            continue;
        }

        const filePath = `${outputDir}_${results}`;

        try {
            await fs.access(filePath);
            artifacts.push({
                exposureId: node.id,
                name: exposureData?.name || node.id,
                results,
                filePath
            });
        } catch {
        }
    }

    return artifacts;
};
