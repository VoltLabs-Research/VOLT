import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';
import { useGlobalAttributesStore } from '@/modules/analysis/stores/global-attributes.store';

interface PlotAttributeVsFrameInput {
    attribute: string;
    description?: string;
}

const plotAttributeVsFrame: ClientToolHandler<PlotAttributeVsFrameInput> = {
    name: 'plot_attribute_vs_frame',
    needsViewer: true,

    run(input): ClientToolResult {
        if (!input.attribute?.trim()) {
            return {
                ok: false,
                summary: 'Attribute name is required.',
                reason: 'invalid_attribute'
            };
        }

        useGlobalAttributesStore.getState().openChart({ attribute: input.attribute });

        return {
            ok: true,
            summary: `Global attributes panel opened for attribute "${input.attribute}"`
        };
    },

    describeEffect(input, result) {
        if (!result.ok) return { label: 'Chart unavailable', icon: 'chart-line' };
        return { label: `Charted ${input.attribute} vs frame`, icon: 'chart-line' };
    }
};

export default plotAttributeVsFrame;
