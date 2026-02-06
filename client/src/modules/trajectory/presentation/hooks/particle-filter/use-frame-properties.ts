import { useState, useEffect } from 'react';
import { useState, useEffect } from 'react';
import useColorCodingUseCases from '../color-coding/use-color-coding-use-cases';
import type { ColorCodingProperties } from '../../../application/dtos/color-coding';

interface UseFramePropertiesParams{
    trajectoryId?: string;
    analysisId?: string;
    timestep?: number;
};

interface UseFramePropertiesResult{
    properties: ColorCodingProperties;
    isLoading: boolean;
    error: string | null;
};

const useFrameProperties = (params: UseFramePropertiesParams): UseFramePropertiesResult => {
    const { trajectoryId, analysisId, timestep } = params;
    const [properties, setProperties] = useState<ColorCodingProperties>({ base: [], modifiers: {} });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { colorCodingRepository } = useColorCodingUseCases();

    const fetchProperties = async (
        trajectoryId: string,
        analysisId: string,
        timestep: number
    ): Promise<void> => {
        setIsLoading(true);
        setError(null);

        try{
            const result = await colorCodingRepository.getProperties({
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
        if(!trajectoryId || timestep === undefined) return;

        fetchProperties(trajectoryId, analysisId || '', timestep);
    }, [trajectoryId, analysisId, timestep, colorCodingRepository]);

    return { properties, isLoading, error };
};

export default useFrameProperties;
