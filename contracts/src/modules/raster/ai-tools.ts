export interface RenderSceneScreenshotInput{
    /**
     * The trajectory to render.
     */
    trajectoryId: string;
    /**
     * Optional analysis whose result frame should be rendered. Requires "model".
     */
    analysisId?: string;
    /**
     * Optional model name within the analysis. Requires "analysisId".
     */
    model?: string;
    /**
     * Trajectory timestep to render. Defaults to the first frame (0).
     */
    timestep?: number;
}
