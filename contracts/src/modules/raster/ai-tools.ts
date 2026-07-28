import { z } from 'zod';

export const renderSceneScreenshotSchema = z.object({
    trajectoryId: z.string().describe('The trajectory to render.'),
    analysisId: z.string().optional().describe('Optional analysis whose result frame should be rendered. Requires "model".'),
    model: z.string().optional().describe('Optional model name within the analysis. Requires "analysisId".'),
    timestep: z.number().optional().describe('Trajectory timestep to render. Defaults to the first frame (0).')
});

export type RenderSceneScreenshotInput = z.infer<typeof renderSceneScreenshotSchema>;
