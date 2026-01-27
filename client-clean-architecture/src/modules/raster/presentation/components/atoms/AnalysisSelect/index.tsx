import React from 'react';
import type { AnalysisSelectProps } from '@/types/raster';
import Select from '@/shared/presentation/components/atoms/form/Select';
import { usePluginStore } from '@/modules/plugins/presentation/stores/plugin-slice';
import { useMemo } from 'react';
import Container from '@/shared/presentation/components/primitives/Container';

const AnalysisSelect: React.FC<AnalysisSelectProps> = ({
    analysesNames,
    selectedAnalysis,
    onAnalysisChange,
    isLoading
}) => {
    const modifiers = usePluginStore((s) => s.modifiers);
    
    const options = useMemo(() => {
        return(analysesNames || []).map((analysis: any) => {
            const modifier = modifiers.find(m => m.pluginSlug === analysis.plugin);
            return {
                value: analysis._id,
                label: modifier?.name || analysis.plugin || 'Analysis',
                title: modifier?.name || analysis.plugin || 'Analysis'
            };
        });
    }, [analysesNames, modifiers]);

    return(
        <Container>
            <Select
                onDark
                value={selectedAnalysis ?? ''}
                className='raster-analysis-select'
                onChange={onAnalysisChange}
                options={options}
                disabled={!analysesNames.length || isLoading}
            />
        </Container>
    );
};

export default AnalysisSelect;
