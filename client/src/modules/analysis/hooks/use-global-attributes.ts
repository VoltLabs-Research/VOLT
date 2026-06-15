import { useQuery } from '@tanstack/react-query';
import service from '../api/global-attributes-service';
import type {
    GlobalAttributesMetadataItem,
    GlobalAttributesTimeSeriesResponse
} from '../api/global-attributes-service';

export const useGlobalAttributesMetadata = (
    analysisId: string | undefined
): { data: GlobalAttributesMetadataItem[] | undefined; isLoading: boolean } => {
    const query = useQuery({
        queryKey: ['global-attributes', 'metadata', analysisId],
        queryFn: () => service.getMetadata({ analysisId: analysisId! }),
        enabled: Boolean(analysisId),
        staleTime: 60_000
    });

    return { data: query.data?.attributes, isLoading: query.isLoading };
};

export const useGlobalAttributesTimeSeries = (
    analysisId: string | undefined,
    attribute: string | undefined,
    frameStart?: number,
    frameEnd?: number
): { data: GlobalAttributesTimeSeriesResponse | undefined; isLoading: boolean } => {
    const query = useQuery({
        queryKey: ['global-attributes', 'timeseries', analysisId, attribute, frameStart, frameEnd],
        queryFn: () => service.getTimeSeries({
            analysisId: analysisId!,
            attribute: attribute!,
            frameStart,
            frameEnd
        }),
        enabled: Boolean(analysisId && attribute),
        staleTime: 60_000
    });

    return { data: query.data, isLoading: query.isLoading };
};
