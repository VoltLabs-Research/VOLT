import { useEditorStore } from '@/modules/canvas/store/editor';

import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';

interface SetEnvironmentInput {
    backgroundColor?: string;
    grid?: { enabled?: boolean };
    fog?: {
        enableFog?: boolean;
        fogColor?: string;
        fogNear?: number;
        fogFar?: number;
    };
}

const setEnvironment: ClientToolHandler<SetEnvironmentInput> = {
    name: 'set_environment',
    needsViewer: true,

    run(input, ctx): ClientToolResult {
        const changes: string[] = [];
        const applied: Record<string, unknown> = {};

        ctx.markViewerActing();
        const store = useEditorStore.getState();

        if (typeof input.backgroundColor === 'string' && input.backgroundColor) {
            store.environment.setBackgroundColor(input.backgroundColor);
            applied.backgroundColor = input.backgroundColor;
            changes.push(`background ${input.backgroundColor}`);
        }

        if (input.grid && typeof input.grid.enabled === 'boolean') {
            store.grid.setGrid({ enabled: input.grid.enabled });
            applied.gridEnabled = input.grid.enabled;
            changes.push(input.grid.enabled ? 'grid on' : 'grid off');
        }

        if (input.fog && typeof input.fog === 'object') {
            const fogConfig: { enableFog?: boolean; fogColor?: string; fogNear?: number; fogFar?: number } = {};
            if (typeof input.fog.enableFog === 'boolean') fogConfig.enableFog = input.fog.enableFog;
            if (typeof input.fog.fogColor === 'string' && input.fog.fogColor) fogConfig.fogColor = input.fog.fogColor;
            if (typeof input.fog.fogNear === 'number' && Number.isFinite(input.fog.fogNear)) fogConfig.fogNear = input.fog.fogNear;
            if (typeof input.fog.fogFar === 'number' && Number.isFinite(input.fog.fogFar)) fogConfig.fogFar = input.fog.fogFar;

            if (Object.keys(fogConfig).length > 0) {
                store.environment.setFogConfig(fogConfig);
                applied.fog = fogConfig;
                changes.push('fog');
            }
        }

        if (changes.length === 0) {
            return {
                ok: false,
                summary: 'No environment changes requested.',
                reason: 'no_op',
                hint: 'Provide at least one of backgroundColor, grid.enabled, or fog.'
            };
        }

        return {
            ok: true,
            summary: `Updated environment: ${changes.join(', ')}.`,
            data: applied
        };
    },

    describeEffect(_input, result) {
        if (!result.ok) {
            return { label: 'Environment change failed', icon: 'globe' };
        }
        return { label: 'Adjusted environment', icon: 'globe' };
    }
};

export default setEnvironment;
