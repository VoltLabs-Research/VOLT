import { useEditorStore } from '@/modules/canvas/store/editor';

import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';
import type { SetEnvironmentInput } from '@volt/contracts/modules/ai/ai-tools';

const setEnvironment: ClientToolHandler<SetEnvironmentInput> = {
    name: 'set_environment',
    needsViewer: true,

    run(input, ctx): ClientToolResult {
        const changes: string[] = [];
        const applied: Record<string, unknown> = {};

        ctx.markViewerActing();
        const store = useEditorStore.getState();

        if (input.backgroundColor) {
            store.environment.setBackgroundColor(input.backgroundColor);
            applied.backgroundColor = input.backgroundColor;
            changes.push(`background ${input.backgroundColor}`);
        }

        if (input.grid?.enabled !== undefined) {
            store.grid.setGrid({ enabled: input.grid.enabled });
            applied.gridEnabled = input.grid.enabled;
            changes.push(input.grid.enabled ? 'grid on' : 'grid off');
        }

        if (input.fog) {
            const fogConfig: SetEnvironmentInput['fog'] = {};
            if (input.fog.enableFog !== undefined) fogConfig.enableFog = input.fog.enableFog;
            if (input.fog.fogColor) fogConfig.fogColor = input.fog.fogColor;
            if (input.fog.fogNear !== undefined) fogConfig.fogNear = input.fog.fogNear;
            if (input.fog.fogFar !== undefined) fogConfig.fogFar = input.fog.fogFar;

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
            return {
                label: 'Environment change failed',
                icon: 'globe'
            };
        }
        return {
            label: 'Adjusted environment',
            icon: 'globe'
        };
    }
};

export default setEnvironment;
