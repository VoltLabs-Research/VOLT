import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    backgroundColor: z.string().optional().describe('Scene background color as a hex string, e.g. "#070708".'),
    grid: z.object({
        enabled: z.boolean().optional().describe('Whether the reference floor grid is visible.')
    }).optional().describe('Reference-grid settings.'),
    fog: z.object({
        enableFog: z.boolean().optional().describe('Whether distance fog is enabled.'),
        fogColor: z.string().optional().describe('Fog color as a hex string.'),
        fogNear: z.number().optional().describe('Distance at which fog begins.'),
        fogFar: z.number().optional().describe('Distance at which fog is fully opaque.')
    }).optional().describe('Distance-fog settings.')
});

type SetEnvironmentParams = z.infer<typeof parameters>;

/**
 * CLIENT-EXECUTED. Adjusts scene environment: background color, reference grid
 * visibility, and distance fog. The browser handler (`set_environment.ts`) calls
 * the editor store (`environment.setBackgroundColor`, `grid.setGrid`,
 * `environment.setFogConfig`). This server class only advertises the schema
 * (`clientExecuted = true`).
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class SetEnvironmentAITool extends AITool<SetEnvironmentParams> {
    readonly name = 'set_environment';
    readonly description = 'Adjust the 3D scene environment: background color, the reference floor grid on/off, '
        + 'and distance fog (enable, color, near/far). Provide only the fields you want to change.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
