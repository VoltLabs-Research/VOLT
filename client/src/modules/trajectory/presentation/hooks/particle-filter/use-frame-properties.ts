import { useState, useEffect } from 'react';
import useColorCodingUseCases from '../color-coding/use-color-coding-repository';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import type { ColorCodingProperties } from '../../../application/dtos/color-coding';

const INITIAL_PROPERTIES: ColorCodingProperties = {
    base: [],
    modifiers: {}
};

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
    const [properties, setProperties] = useState<ColorCodingProperties>(INITIAL_PROPERTIES);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { colorCodingRepository } = useColorCodingUseCases();
    const { checkRBACError } = useAccessDenied();

    useEffect(() => {
        if(!trajectoryId || timestep === undefined){
            setProperties(INITIAL_PROPERTIES);
            setIsLoading(false);
            setError(null);
            return;
        }

        let isCancelled = false;

        setProperties(INITIAL_PROPERTIES);
        setIsLoading(true);
        setError(null);

        const fetchProperties = async (): Promise<void> => {
            try{
                const result = await colorCodingRepository.getProperties({
                    trajectoryId,
                    analysisId: analysisId || '',
                    timestep
                });

                if(isCancelled){
                    return;
                }

                setProperties(result);
            }catch(err){
                if(isCancelled){
                    return;
                }

                if(!checkRBACError(err)){
                    if(err instanceof Error){
                        setError(err.message);
                    }else{
                        setError('Failed to fetch properties');
                    }
                }
            }finally{
                if(!isCancelled){
                    setIsLoading(false);
                }
            }
        };

        void fetchProperties();

        return () => {
            isCancelled = true;
        };
    }, [trajectoryId, analysisId, timestep, colorCodingRepository, checkRBACError]);

    return { properties, isLoading, error };
};

export default useFrameProperties;
