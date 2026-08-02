import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AIToolProvider } from '@shared/ai/provider-registry';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { ErrorCodes } from '@core/constants/error-codes';
import RasterService from '@modules/raster/services/RasterService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { RenderSceneScreenshotInput } from '@volt/contracts/modules/raster/ai-tools';
import { resolveServerBaseUrl } from '@shared/infrastructure/utilities/server-url';


@AIToolProvider()
export default class RasterAIToolController extends AIToolController {
    #service = new RasterService();

    @AITool({
        name: 'render_scene_screenshot',
        description: 'Render a PNG screenshot of a trajectory frame (optionally for a specific analysis result and model). '
            + 'Ensures a server-side raster exists for the frame and returns a viewable image URL.',
        parameters: typia.llm.parameters<RenderSceneScreenshotInput>(),
        validate: typia.createValidate<RenderSceneScreenshotInput>()
    })
    async renderSceneScreenshot(input: RenderSceneScreenshotInput & AIToolScope) {
        const { trajectoryId, analysisId, model } = input;
        const timestep = input.timestep ?? 0;

        if ((analysisId && !model) || (!analysisId && model)) {
            return {
                summary: 'An analysis screenshot requires both "analysisId" and "model".',
                error: 'invalid_input'
            };
        }

        try {
            await this.#service.triggerRasterization(input);
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
        const segments = ['api', 'rasters', input.teamId, trajectoryId, 'frames', String(timestep)];
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
