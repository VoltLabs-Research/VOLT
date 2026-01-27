export interface RasterMetadataResult {
    analyses: Record<string, any>;
    analysesNames: any[];
    selectedAnalysis: string | null;
    trajectory: any | null;
}

export class RasterMetadataService {
    normalize(metadata: any, nowIso: string): RasterMetadataResult {
        const analyses = metadata?.analyses ?? {};
        const trajectory = metadata?.trajectory ?? null;

        let names = Object.values(analyses).map((analysis: any) => analysis);
        let finalAnalyses = analyses;

        if (names.length === 0 && trajectory?.frames?.length > 0) {
            const previewFrames: Record<string, any> = {};
            trajectory.frames.forEach((frame: any) => {
                previewFrames[frame.timestep] = {
                    timestep: frame.timestep,
                    availableModels: ['preview']
                };
            });

            finalAnalyses = {
                __preview__: {
                    _id: '__preview__',
                    frames: previewFrames
                }
            };

            names = [{
                _id: '__preview__',
                modifier: 'Preview',
                config: {},
                createdAt: nowIso
            }];
        }

        return {
            analyses: finalAnalyses,
            analysesNames: names,
            selectedAnalysis: names[0]?._id || null,
            trajectory
        };
    }
}
