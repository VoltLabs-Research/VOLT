import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';
import type { LaunchGrainSegmentationAnalysisInput } from '@volt/contracts/modules/ai/ai-tools';
import { useCanvasPipelineStore } from '@/modules/canvas/store/canvas-pipeline';

const launchGrainSegmentation: ClientToolHandler<LaunchGrainSegmentationAnalysisInput> = {
    name: 'launch_grain_segmentation_analysis',
    needsViewer: true,

    run(input): ClientToolResult {
        const threshold = input.dislocation_density_threshold;

        const stageId = useCanvasPipelineStore.getState().addStage('analysis-plugin', {
            pluginId: 'grain-segmentation',
            argValues: { dislocation_density_threshold: threshold },
            selectedTimesteps: input.frame !== undefined ? [input.frame] : undefined
        });
        if (!stageId) {
            return {
                ok: false,
                summary: 'No active trajectory to add the analysis to.',
                reason: 'no_active_trajectory',
                hint: 'Open a trajectory in the canvas before launching an analysis.'
            };
        }

        return {
            ok: true,
            summary: `Grain segmentation stage added: threshold=${threshold}${input.frame !== undefined ? ` frame=${input.frame}` : ''}`
        };
    },

    describeEffect(input, result) {
        if (!result.ok) return {
            label: 'Grain segmentation unavailable',
            icon: 'grain'
        };
        return {
            label: `Added grain-segmentation stage (threshold=${input.dislocation_density_threshold})`,
            icon: 'grain'
        };
    }
};

export default launchGrainSegmentation;
