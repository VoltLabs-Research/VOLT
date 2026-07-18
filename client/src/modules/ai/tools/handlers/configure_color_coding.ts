import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';
import { useCanvasPipelineStore } from '@/modules/canvas/stores/canvas-pipeline';
import { COLORMAP_NAMES, type ColormapName } from '@/modules/fractal/services/colormaps';

interface ConfigureColorCodingInput {
    property: string;
    colorMap?: string;
    min?: number;
    max?: number;
}

const resolveGradient = (raw?: string): ColormapName => {
    if (!raw) return 'Viridis';
    const match = COLORMAP_NAMES.find((name) => name.toLowerCase() === raw.toLowerCase());
    return match ?? 'Viridis';
};

const configureColorCoding: ClientToolHandler<ConfigureColorCodingInput> = {
    name: 'configure_color_coding',
    needsViewer: true,

    run(input): ClientToolResult {
        const gradient = resolveGradient(input.colorMap);
        const manualRange = typeof input.min === 'number' && typeof input.max === 'number'
            ? { min: input.min, max: input.max }
            : undefined;

        const stageId = useCanvasPipelineStore.getState().addStage('color-coding', {
            property: input.property,
            gradient,
            ...(manualRange ? { manualRange } : {})
        });
        if (!stageId) {
            return {
                ok: false,
                summary: 'No active trajectory to add color coding to.',
                reason: 'no_active_trajectory',
                hint: 'Open a trajectory in the canvas before configuring color coding.'
            };
        }

        return {
            ok: true,
            summary: `Color coding stage added: "${input.property}" using ${gradient}`
        };
    },

    describeEffect(input, result) {
        if (!result.ok) return { label: 'Color coding unavailable', icon: 'palette' };
        return { label: `Color coded by ${input.property}`, icon: 'palette' };
    }
};

export default configureColorCoding;
