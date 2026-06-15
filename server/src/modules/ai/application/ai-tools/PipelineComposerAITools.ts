import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const configureColorCodingParams = z.object({
    property: z.string().describe('Per-atom property name to color by (e.g. "StructureType", "Epot", "cluster_id").'),
    colorMap: z.enum(['viridis', 'plasma', 'inferno', 'magma', 'cool', 'warm', 'rainbow', 'jet']).optional()
        .describe('Color map name. Defaults to "viridis".'),
    min: z.number().optional().describe('Minimum value for the color scale. Omit to auto-scale.'),
    max: z.number().optional().describe('Maximum value for the color scale. Omit to auto-scale.')
});

/**
 * CLIENT-EXECUTED. Pushes a color-coding modifier to the instant-modifier-stack.
 * The browser handler (`configure_color_coding.ts`) modifies the viewer store.
 * This server class only advertises the schema.
 *
 * NOTE: Depends on the instant-modifier-stack (Surface A) from workstream 00.
 * Until that primitive exists, the client handler returns a no-op-until-available
 * guard.
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ConfigureColorCodingAITool extends AITool<z.infer<typeof configureColorCodingParams>> {
    readonly name = 'configure_color_coding';
    readonly description = 'Apply a color-coding modifier to the 3D viewer: color atoms by a per-atom property '
        + '(e.g. StructureType, Epot, cluster_id) using a named color map. Changes broadcast to collaborators.';
    readonly parameters = configureColorCodingParams;
    protected readonly clientExecuted = true;
}

const plotAttributeVsFrameParams = z.object({
    attribute: z.string().describe('Global attribute name to plot across frames (e.g. "TotalEnergy", "Temperature").'),
    description: z.string().optional().describe('Human-readable description of what this chart shows.')
});

/**
 * CLIENT-EXECUTED. Opens a chart panel showing an attribute vs frame index.
 * Depends on global-attribute time-series infrastructure (workstream 06).
 * Until that exists, the client handler returns a no-op guard.
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class PlotAttributeVsFrameAITool extends AITool<z.infer<typeof plotAttributeVsFrameParams>> {
    readonly name = 'plot_attribute_vs_frame';
    readonly description = 'Create a chart showing a global attribute value across trajectory frames. '
        + 'Use for time-series like TotalEnergy, Temperature, Pressure, etc.';
    readonly parameters = plotAttributeVsFrameParams;
    protected readonly clientExecuted = true;
}

const pushExpressionSelectParams = z.object({
    formula: z.string().describe(
        'Boolean expression over per-atom properties (e.g. "Position.X > 10", "StructureType == 1"). '
        + 'Atoms matching the formula are selected/highlighted.'
    ),
    description: z.string().optional().describe('Human-readable label for this selection.')
});

/**
 * CLIENT-EXECUTED. Pushes an expression-select modifier that highlights atoms
 * matching the formula. Depends on workstream 01 expression engine.
 * Client handler returns a no-op-until-available guard if expression engine is absent.
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class PushExpressionSelectAITool extends AITool<z.infer<typeof pushExpressionSelectParams>> {
    readonly name = 'push_expression_select';
    readonly description = 'Highlight atoms matching a boolean formula over per-atom properties. '
        + 'Example: "Position.X > 10 && StructureType == 2". The match count is returned.';
    readonly parameters = pushExpressionSelectParams;
    protected readonly clientExecuted = true;
}

const launchGrainSegmentationParams = z.object({
    dislocation_density_threshold: z.number().min(0).max(1).describe(
        'Dislocation density threshold (0–1). Segments with density below this are excluded from the export.'
    ),
    frame: z.number().int().min(0).optional().describe('Frame index to analyze. Defaults to current frame.')
});

/**
 * NOT client-executed. Pre-fills the analysis submission modal with the
 * grain-segmentation plugin + threshold and queues the job.
 * CLIENT-EXECUTED for the UI pre-fill step; server returns jobId for async tracking.
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class LaunchGrainSegmentationAITool extends AITool<z.infer<typeof launchGrainSegmentationParams>> {
    readonly name = 'launch_grain_segmentation_analysis';
    readonly description = 'Queue a grain-segmentation analysis with the given dislocation-density threshold. '
        + 'Returns a jobId for tracking. The result renders as a dislocation network GLB in the viewer.';
    readonly parameters = launchGrainSegmentationParams;
    protected readonly clientExecuted = true;
}
