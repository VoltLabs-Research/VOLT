import { useEffect, useState } from 'react';
import api from '@/api';

interface UseFramePropertiesProps{
    analysisId?: string;
    frame?: number;
    trajectoryId?: string;
};

const useFrameProperties = ({ analysisId, frame, trajectoryId }: UseFramePropertiesProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [properties, setProperties] = useState<{ base: string[], modifiers: Record<string, string[]> }>({ base: [], modifiers: {} });

    const getProps = async () => {
        setIsLoading(true);
        try{
            const res = await api.get(`/color-coding/properties/${trajectoryId}/${analysisId}?timestep=${frame}`);
            setProperties(res.data.data);
        }finally{
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if(!analysisId || !frame || !trajectoryId) return;
        getProps();
    }, [analysisId, frame, trajectoryId]);

    return { properties, isLoading };
};

export default useFrameProperties;