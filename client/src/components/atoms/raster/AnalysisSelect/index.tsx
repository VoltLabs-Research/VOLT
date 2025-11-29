import React from 'react';
import type { AnalysisSelectProps } from '@/types/raster';
import Select from '@/components/atoms/form/Select';
import usePluginStore from '@/stores/plugins';
import { useAnalysisFormatting } from '@/hooks/useAnalysisFormatting';

const AnalysisSelect: React.FC<AnalysisSelectProps> = ({
    analysesNames,
    selectedAnalysis,
    onAnalysisChange,
    isLoading
}) => {
    const manifests = usePluginStore((s) => s.manifests);
    const options = useAnalysisFormatting(analysesNames || [], manifests);

    return (
        <div className='raster-analyses-selection-container'>
            <Select
                onDark
                value={selectedAnalysis ?? ''}
                className='raster-analysis-select'
                onChange={onAnalysisChange}
                options={options}
                disabled={!analysesNames.length || isLoading}
            />
        </div>
    );
};

export default AnalysisSelect;