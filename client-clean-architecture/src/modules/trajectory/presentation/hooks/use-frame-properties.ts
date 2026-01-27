import { useEffect, useState } from 'react';
import { getRasterUseCases } from '@/modules/raster/application/registry';
import type { RasterUseCases } from '@/modules/raster/application/registry';

interface UseFramePropertiesProps {
    analysisId?: string;
    frame?: number;
    trajectoryId?: string;
};

const useFrameProperties = ({ analysisId, frame, trajectoryId }: UseFramePropertiesProps) => {
    const resolveUseCases = (): RasterUseCases => getRasterUseCases();
    const [isLoading, setIsLoading] = useState(true);
    const [properties, setProperties] = useState<{ base: string[], modifiers: Record<string, string[]> }>({ base: [], modifiers: {} });

    const getProps = async () => {
        setIsLoading(true);
        try {
            const { getColorCodingPropertiesUseCase } = resolveUseCases();
            const data = await getColorCodingPropertiesUseCase.execute(trajectoryId!, analysisId, frame!);
            setProperties(data);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Only require trajectoryId and frame, analysisId is optional
        if (!frame || !trajectoryId) return;
        getProps();
    }, [analysisId, frame, trajectoryId]);

    return { properties, isLoading };
};

export default useFrameProperties;
