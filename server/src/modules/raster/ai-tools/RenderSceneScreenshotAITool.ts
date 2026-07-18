import { ErrorCodes } from '@core/constants/error-codes';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import RasterService from '@modules/raster/services/RasterService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const resolveServerBaseUrl = (): string => {
    const configuredServerUrl = process.env.SERVER_ENDPOINT?.trim();
    if (configuredServerUrl) {
        return configuredServerUrl.replace(/\/+$/g, '');
    }

    const protocol = process.env.SERVER_SCHEMA?.trim() || 'http';
    const host = process.env.SERVER_HOSTNAME?.trim() || 'localhost';
    return `${protocol}://${host}`;
};

export class RenderSceneScreenshotAITool extends AITool {
    readonly name = 'render_scene_screenshot';
    readonly description =
        'Render a PNG screenshot of a trajectory frame (optionally for a specific analysis result and model). '
        + 'Ensures a server-side raster exists for the frame and returns a viewable image URL.';
    readonly parameters = z.object({
        trajectoryId: z.string().describe('The trajectory to render.'),
        analysisId: z.string().optional().describe('Optional analysis whose result frame should be rendered. Requires "model".'),
        model: z.string().optional().describe('Optional model name within the analysis. Requires "analysisId".'),
        timestep: z.number().optional().describe('Trajectory timestep to render. Defaults to the first frame (0).')
    });

    #service = new RasterService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const { trajectoryId, analysisId, model } = params;
        const timestep = params.timestep ?? 0;

        if ((analysisId && !model) || (!analysisId && model)) {
            return {
                summary: 'An analysis screenshot requires both "analysisId" and "model".',
                error: 'invalid_input'
            };
        }

        try {
            await this.#service.triggerRasterization({ trajectoryId, teamId: scope.teamId });
        } catch (error) {
            const code = error instanceof ApplicationError ? error.code : undefined;
            if (code !== ErrorCodes.RASTER_ALREADY_QUEUED) {
                if (code === ErrorCodes.RASTER_NOT_FOUND) {
                    return {
                        summary: 'No rasterizable models were found for this trajectory; nothing to render.',
                        error: 'no_rasterizable_models'
                    };
                }

                return {
                    summary: 'Could not start rasterization. No compute cluster appears to be enrolled or online.',
                    error: 'no_compute_cluster'
                };
            }
        }

        const baseUrl = resolveServerBaseUrl();
        const segments = ['api', 'rasters', scope.teamId, trajectoryId, 'frames', String(timestep)];
        if (analysisId && model) {
            segments.push(analysisId, model);
        }
        const url = `${baseUrl}/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;

        const summary = analysisId && model
            ? `Screenshot URL for analysis "${analysisId}" (model "${model}") at timestep ${timestep}.`
            : `Screenshot URL for the trajectory scene at timestep ${timestep}.`;

        return {
            payloadType: 'image' as const,
            mediaType: 'image/png' as const,
            url,
            summary
        };
    }
}
