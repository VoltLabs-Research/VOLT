import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { filterPropertiesQuery } from './queries';
import type { FilterPropertiesData } from '../../api/dtos/particle-filter';

interface UseFramePropertiesParams {
    trajectoryId?: string;
    analysisId?: string;
    timestep?: number;
};

interface UseFramePropertiesResult {
    properties: FilterPropertiesData;
    isLoading: boolean;
    error: string | null;
};

const INITIAL_PROPERTIES: FilterPropertiesData = {
    dump: [],
    perAtom: {},
    exposureNames: {}
};

export default function useFrameProperties(params: UseFramePropertiesParams): UseFramePropertiesResult {
    const { trajectoryId, analysisId, timestep } = params;
    const { checkAccessDeniedError } = useAccessDenied();

    const shouldFetch = Boolean(trajectoryId) && timestep !== undefined;

    const {
        data,
        isLoading,
        error: queryError
    } = filterPropertiesQuery(
        {
            trajectoryId: trajectoryId || '',
            analysisId: analysisId || '',
            timestep: timestep ?? 0
        },
        {
            enabled: shouldFetch,
            retry: (failureCount, error) => {
                if (checkAccessDeniedError(error)) {
                    return false;
                }
                return failureCount < 2;
            }
        }
    );

    let errorMessage: string | null = null;
    if (queryError && !checkAccessDeniedError(queryError)) {
        errorMessage = queryError.message || 'Failed to fetch properties';
    }

    return {
        properties: data ?? INITIAL_PROPERTIES,
        isLoading,
        error: errorMessage
    };
}
