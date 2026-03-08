import { filterPropertiesQuery } from './particle-filter/queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import type { FilterPropertiesData } from '../api/dtos/get-filter-properties';

const INITIAL_PROPERTIES: FilterPropertiesData = {
    dump: [],
    perAtom: {}
};

interface UseFramePropertiesParams {
    trajectoryId?: string;
    analysisId?: string;
    timestep?: number;
}

interface UseFramePropertiesResult {
    properties: FilterPropertiesData;
    isLoading: boolean;
    error: string | null;
}

const useFrameProperties = (params: UseFramePropertiesParams): UseFramePropertiesResult => {
    const { trajectoryId, analysisId, timestep } = params;
    const { checkRBACError } = useAccessDenied();

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
                if (checkRBACError(error)) {
                    return false;
                }
                return failureCount < 2;
            }
        }
    );

    let errorMessage: string | null = null;
    if (queryError && !checkRBACError(queryError)) {
        errorMessage = queryError.message || 'Failed to fetch properties';
    }

    return {
        properties: data ?? INITIAL_PROPERTIES,
        isLoading,
        error: errorMessage
    };
};

export default useFrameProperties;
