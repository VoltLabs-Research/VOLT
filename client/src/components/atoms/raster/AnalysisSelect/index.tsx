import React from 'react';
import type { AnalysisSelectProps } from '@/types/raster';
import Select from '@/components/atoms/form/Select';

const AnalysisSelect: React.FC<AnalysisSelectProps> = ({
    analysesNames,
    selectedAnalysis,
    onAnalysisChange,
    isLoading
}) => {
    return (
        <div className='raster-analyses-selection-container'>
            <Select
                onDark
                value={selectedAnalysis ?? ''}
                className='raster-analysis-select'
                onChange={onAnalysisChange}
                options={analysesNames.map((a) => ({ value: a._id, title: a.name }))}
                disabled={!analysesNames.length || isLoading}
            />
        </div>
    );
};

export default AnalysisSelect;