import { useEditorStore } from '@/modules/canvas/stores/editor';
import { DEFAULT_SCENE } from '@/modules/fractal/utilities/scene-utils';

import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';

interface SetVisibleLayersInput {
    layer?: string;
    visible?: boolean;
}

const BASE_LAYER_ALIASES = new Set(['atoms', 'particles', 'trajectory', 'default', 'base', 'points']);

const setVisibleLayers: ClientToolHandler<SetVisibleLayersInput> = {
    name: 'set_visible_layers',
    needsViewer: true,

    run(input, ctx): ClientToolResult {
        const layer = (typeof input.layer === 'string' ? input.layer : '').trim().toLowerCase();
        const visible = input.visible !== false;

        if (!layer) {
            return {
                ok: false,
                summary: 'No layer specified.',
                reason: 'missing_layer',
                hint: 'Pass layer: "atoms" with visible: true/false.'
            };
        }

        if (!BASE_LAYER_ALIASES.has(layer)) {
            return {
                ok: false,
                summary: `Layer "${layer}" cannot be toggled here.`,
                reason: 'unsupported_layer',
                hint: 'Only the base atomistic layer ("atoms") is toggleable. Analysis overlays '
                    + '(plugin results, color-coding, filters, line styles) are managed from their own panels.'
            };
        }

        ctx.markViewerActing();
        const store = useEditorStore.getState();
        const isActive = store.activeScenes.some((s) => s.source === 'default');

        if (visible && !isActive) {
            store.addScene(DEFAULT_SCENE);
        } else if (!visible && isActive) {
            store.removeScene(DEFAULT_SCENE);
        }

        return {
            ok: true,
            summary: `${visible ? 'Showed' : 'Hid'} the atoms layer.`,
            data: { layer: 'atoms', visible }
        };
    },

    describeEffect(input, result) {
        if (!result.ok) {
            return { label: 'Layer change failed', icon: 'layers' };
        }
        const visible = input.visible !== false;
        return { label: `${visible ? 'Showed' : 'Hid'} atoms layer`, icon: 'layers' };
    }
};

export default setVisibleLayers;
