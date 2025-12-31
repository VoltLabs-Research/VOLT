import React from 'react';
import type { AnalysisSelectProps } from '@/types/raster';
import Select from '@/components/atoms/form/Select';
import { usePluginStore } from '@/stores/slices/plugin/plugin-slice';
import { useMemo } from 'react';
import Container from '@/components/primitives/Container';

const AnalysisSelect: React.FC<AnalysisSelectProps> = ({
    analysesNames,
    selectedAnalysis,
    onAnalysisChange,
    isLoading
}) => {
    const getModifiers = usePluginStore((s) => s.getModifiers);

    const options = useMemo(() => {
        const modifiers = getModifiers();
        return(analysesNames || []).map((analysis: any) => {
            const modifier = modifiers.find(m => m.pluginSlug === analysis.plugin);
            return {
                value: analysis._id,
                label: modifier?.name || analysis.plugin || 'Analysis',
                title: modifier?.name || analysis.plugin || 'Analysis'
            };
        });
    }, [analysesNames, getModifiers]);

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
