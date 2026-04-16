import { WorkflowNodeType } from '../contracts';
import { readWorkflowExposureData } from './InlineWorkflowShared';
import fs from 'node:fs/promises';
import type { WorkflowDefinition } from '@/shared/contracts';
import type { InlineExposureArtifact } from './InlineWorkflowShared';

export const collectInlineExposureArtifacts = async (
    workflow: WorkflowDefinition,
    outputDir: string
): Promise<InlineExposureArtifact[]> => {
    const artifacts: InlineExposureArtifact[] = [];

    for (const node of workflow.nodes) {
        if (node.type !== WorkflowNodeType.Exposure) {
            continue;
        }

        const exposureData = readWorkflowExposureData(node.data.exposure);
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
