interface BuildAtomsViewerPathParams {
    trajectoryId: string;
    timestep: number;
    analysisId?: string;
};

export const buildAtomsViewerPath = ({
    trajectoryId,
    timestep,
    analysisId
}: BuildAtomsViewerPathParams): string => {
    const searchParams = new URLSearchParams({
        timestep: String(timestep)
    });

    if (analysisId) {
        searchParams.set('analysisId', analysisId);
    }

    return `/dashboard/trajectory/${trajectoryId}/atoms?${searchParams.toString()}`;
};
