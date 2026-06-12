import { useEditorStore } from '@/modules/canvas/stores/editor';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';

interface OpenPanelInput {
    sidebarOption?: string;
    modifier?: string;
}

/**
 * Opens an editor sidebar panel and/or selects a modifier in the viewer editor
 * via the editor store's configuration slice. At least one of sidebarOption /
 * modifier must be provided.
 */
const openPanel: ClientToolHandler<OpenPanelInput> = {
    name: 'open_panel',
    needsViewer: true,

    run(input, ctx): ClientToolResult {
        const sidebarOption = typeof input.sidebarOption === 'string' ? input.sidebarOption.trim() : '';
        const modifier = typeof input.modifier === 'string' ? input.modifier.trim() : '';

        if (!sidebarOption && !modifier) {
            return {
                ok: false,
                summary: 'Nothing to open.',
                reason: 'missing_target',
                hint: 'Provide a sidebarOption and/or a modifier to open.'
            };
        }

        ctx.markViewerActing();

        const { configuration } = useEditorStore.getState();

        if (sidebarOption) {
            configuration.setActiveSidebarOption(sidebarOption);
        }

        if (modifier) {
            configuration.setActiveModifier(modifier);
        }

        const parts: string[] = [];
        if (sidebarOption) parts.push(`panel "${sidebarOption}"`);
        if (modifier) parts.push(`modifier "${modifier}"`);

        return {
            ok: true,
            summary: `Opened ${parts.join(' and ')}.`,
            data: { sidebarOption: sidebarOption || undefined, modifier: modifier || undefined }
        };
    },

    describeEffect(_input, result) {
        if (!result.ok) {
            return { label: 'Could not open panel', icon: 'panel' };
        }
        const data = result.data as { sidebarOption?: string; modifier?: string } | undefined;
        const target = data?.sidebarOption ?? data?.modifier ?? 'panel';
        return { label: `Opened ${target}`, icon: 'panel' };
    }
};

export default openPanel;
