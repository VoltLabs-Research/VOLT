import { useState, useEffect } from 'react';
import useParticleFilterUseCases from './use-particle-filter-use-cases';
import type { FilterPropertiesData } from '../../../application/dtos/particle-filter';

interface UseFramePropertiesParams{
    trajectoryId?: string;
    analysisId?: string;
    timestep?: number;
};

interface UseFramePropertiesResult{
    properties: FilterPropertiesData | null;
    isLoading: boolean;
    error: string | null;
};

const useFrameProperties = (params: UseFramePropertiesParams): UseFramePropertiesResult => {
    const { trajectoryId, analysisId, timestep } = params;
    const [properties, setProperties] = useState<FilterPropertiesData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { getFilterPropertiesUseCase } = useParticleFilterUseCases();

    const fetchProperties = async (
        trajectoryId: string,
        analysisId: string,
        timestep: number
    ): Promise<void> => {
        setIsLoading(true);
        setError(null);

        try{
            const result = await getFilterPropertiesUseCase.execute({
                trajectoryId,
                analysisId,
                timestep
            });
            setProperties(result);
        }catch(err){
            setError(err instanceof Error ? err.message : 'Failed to fetch properties');
        }finally{
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if(!trajectoryId || !analysisId || timestep === undefined) return;

        fetchProperties(trajectoryId, analysisId, timestep);
    }, [trajectoryId, analysisId, timestep, getFilterPropertiesUseCase]);

    return { properties, isLoading, error };
};

export default useFrameProperties;
