import React, { useEffect, useState, useCallback } from 'react';
import EditorWidget from '@/components/organisms/EditorWidget';
import useTimestepStore from '@/stores/editor/timesteps';
import useTrajectoryStore from '@/stores/trajectories';
import FormField from '@/components/molecules/FormField';
import usePlaybackStore from '@/stores/editor/playback';
import useAnalysisConfigStore from '@/stores/analysis-config';
import Loader from '@/components/atoms/Loader';
import useModifiersStore from '@/stores/modifiers';
import './RenderOptions.css';

const RenderOptions = () => {
    const [dislocationLineWidth, setDislocationLineWidth] = useState(0.8);
    const [tubularSegments, setTubularSegments] = useState(16);
    const [minSegmentPoints, setMinSegmentPoints] = useState(2);
    const dislocationRenderOptions = useModifiersStore((state) => state.dislocationRenderOptions);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const currentTimestep = usePlaybackStore((state) => state.currentTimestep);
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);
    const isRenderOptionsLoading = useTimestepStore((state) => state.isRenderOptionsLoading);

    const applyRenderOptions = useCallback(async () => {
        if (!trajectory?._id || currentTimestep === undefined || !analysisConfig?._id) {
            return;
        }

        try {
            await dislocationRenderOptions(
                trajectory._id, 
                currentTimestep.toString(), 
                analysisConfig._id.toString(), 
                {
                    lineWidth: dislocationLineWidth,
                    colorByType: true,
                    tubularSegments: tubularSegments,
                    minSegmentPoints,
                    material: {
                        baseColor: [1.0, 0.5, 0.0, 1.0],
                        metallic: 0.0,
                        roughness: 0.8
                    }
                }
            );
        } catch (error) {
        }
    }, [trajectory?._id, currentTimestep, analysisConfig?._id, dislocationLineWidth, dislocationRenderOptions]);

    useEffect(() => {
        const keydownHandler = (e) => {
            if (e.key === 'Enter' && !isRenderOptionsLoading) {
                e.preventDefault();
                applyRenderOptions();
            }
        };
        
        document.addEventListener('keydown', keydownHandler);

        return () => {
            document.removeEventListener('keydown', keydownHandler);  
        };
    }, [applyRenderOptions, isRenderOptionsLoading]);

    return (
        <EditorWidget className='render-options-container'>
            <div className='editor-floting-header-container'>
                <h3 className='editor-floating-header-title'>Render Options</h3>

                {isRenderOptionsLoading && (
                    <div className='render-header-loader-container'>
                        <Loader scale={0.5} />
                    </div>  
                )}
            </div>

            <FormField
                fieldValue={dislocationLineWidth}
                fieldKey='lineWidth'
                fieldType='input'
                label='Dislocation Line Width'
                onFieldChange={(_, value) => setDislocationLineWidth(value)}
            />

            <FormField
                fieldValue={minSegmentPoints}
                fieldKey='minSegmentPoints'
                fieldType='input'
                label='Minimum Segment Points'
                onFieldChange={(_, value) => setMinSegmentPoints(value)}
            />

            <FormField
                fieldValue={tubularSegments}
                fieldKey='tubularSegments'
                fieldType='input'
                label='Tubular Segments'
                onFieldChange={(_, value) => setTubularSegments(value)}
            />
        </EditorWidget>
    );
};

export default RenderOptions;