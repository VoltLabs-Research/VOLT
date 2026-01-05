import { useEffect, useState } from 'react';
import rasterApi from '@/services/api/raster/raster';

interface UseFramePropertiesProps {
    analysisId?: string;
    frame?: number;
    trajectoryId?: string;
};

const useFrameProperties = ({ analysisId, frame, trajectoryId }: UseFramePropertiesProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [properties, setProperties] = useState<{ base: string[], modifiers: Record<string, string[]> }>({ base: [], modifiers: {} });

    const getProps = async () => {
        setIsLoading(true);
        try {
            // analysisId is now optional - will return only base properties when absent
            const data = await rasterApi.colorCoding.getProperties(trajectoryId!, analysisId, frame!);
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
