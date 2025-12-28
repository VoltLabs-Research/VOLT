/**
 * RasterResultsRenderer - Dynamically loads and renders raster result components
 * based on manifest configuration
 */

import React, { Suspense, lazy, useEffect, useState } from 'react';
import type { RenderableExposure } from '@/stores/slices/plugin';
import pluginApi from '@/services/api/plugin/plugin';
import { decodeMsgpackBuffer } from '@/utilities/api/msgpack';

// Component registry - maps component names to lazy-loaded components
const RASTER_COMPONENTS: Record<string, React.LazyExoticComponent<any>> = {
    BoxResults: lazy(() => import('@/components/atoms/raster/BoxResults')),
    StatisticsResults: lazy(() => import('@/components/atoms/raster/StatisticsResults')),
};

export interface RasterResultsRendererProps {
    exposure: RenderableExposure;
    timestep: number;
    analysisId: string;
    trajectoryId: string;
    onItemSelect?: (item: any) => void;
}

const RasterResultsRenderer: React.FC<RasterResultsRendererProps> = ({
    exposure,
    timestep,
    analysisId,
    trajectoryId,
    onItemSelect
}) => {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Extract raster config from exposure
    const rasterConfig = typeof exposure.raster === 'object' ? exposure.raster : null;

    // Determine component to render
    const componentName = rasterConfig?.component || 'BoxResults';
    const Component = RASTER_COMPONENTS[componentName];

    useEffect(() => {
        const fetchData = async() => {
            if(!rasterConfig){
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try{
                const response = await pluginApi.getExposureData(
                    exposure.pluginId,
                    trajectoryId,
                    analysisId,
                    exposure.exposureId,
                    timestep
                );

                const decodedData = await decodeMsgpackBuffer(response);

                console.log('Decoded raster data:', decodedData);
                console.log('First item sample:', decodedData?.data?.[0] || decodedData?.dislocations?.[0]);

                setData(decodedData);
            }catch(err: any){
                console.error('Failed to fetch raster data:', err);
                setError(err.message || 'Failed to load data');
            }finally{
                setIsLoading(false);
            }
        };

        fetchData();
    }, [exposure, timestep, analysisId, trajectoryId, rasterConfig]);

    if(!rasterConfig){
        return(
            <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                No raster configuration available
            </div>
        );
    }

    if(!Component){
        return(
            <div style={{ padding: '1rem', color: 'var(--error-color)' }}>
                Unknown component: {componentName}
            </div>
        );
    }

    if(isLoading){
        return(
            <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                Loading {rasterConfig.title || 'data'}...
            </div>
        );
    }

    if(error){
        return(
            <div style={{ padding: '1rem', color: 'var(--error-color)' }}>
                Error: {error}
            </div>
        );
    }

    if(!data){
        return(
            <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                No data available
            </div>
        );
    }

    return(
        <Suspense fallback={<div style={{ padding: '1rem' }}>Loading component...</div>}>
            <Component
                data={data}
                config={rasterConfig}
                onItemSelect={onItemSelect}
            />
        </Suspense>
    );
};

export default RasterResultsRenderer;
