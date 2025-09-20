import React, { useEffect, useRef } from 'react';
import { PiLineSegmentThin } from 'react-icons/pi';
import { GrFormViewHide } from "react-icons/gr";
import { IoIosStats } from "react-icons/io";
import { TfiSlice } from 'react-icons/tfi';
import { RiVipDiamondLine } from "react-icons/ri";
import { HiCubeTransparent } from "react-icons/hi2";
import { PiCirclesThreeLight } from "react-icons/pi";
import { CiImageOn } from 'react-icons/ci';
import { useNavigate } from 'react-router';
import CanvasSidebarOption from '@/components/atoms/CanvasSidebarOption';
import useTrajectoryStore from '@/stores/trajectories';
import useLogger from '@/hooks/core/use-logger';
import useAnalysisConfigStore from '@/stores/analysis-config';
import useEditorUIStore from '@/stores/ui/editor';
import useModifiersStore from '@/stores/modifiers';
import './CanvasSidebarModifiers.css';

const CanvasSidebarModifiers = () => {
    const logger = useLogger('canvas-sidebar-modifiers');
    const activeModifiers = useEditorUIStore((state) => state.activeModifiers);
    const toggleModifiers = useEditorUIStore((state) => state.toggleModifier);

    const structureIdentification = useModifiersStore((state) => state.structureIdentification);
    const computeAnalyses = useModifiersStore((state) => state.computeAnalyses);
    const trajectory = useTrajectoryStore((state) => state.trajectory);

    const idRateSeries = useTrajectoryStore((state) => state.idRateSeries);
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);
    const navigate = useNavigate();

    // We save the previous state to detect which modifiers have just been activated
    const prevActiveRef = useRef<string[]>(activeModifiers);

    useEffect(() => {
        if(!trajectory?._id){
            prevActiveRef.current = activeModifiers;
            return;
        }

        const prev = prevActiveRef.current;
        const justActivated = activeModifiers.filter((modifier) => !prev.includes(modifier));

        // Only for those who matter
        for(const modifier of justActivated){
            console.log('modifier', modifier);
            if(modifier === 'PTM' || modifier === 'CNA' || modifier === 'DIAMOND'){
                logger.log('Activating structure identification:', modifier);
                structureIdentification(trajectory?._id, analysisConfig, modifier);
            }else if(modifier === 'compute-analysis-differences'){
                computeAnalyses(trajectory?._id);
            }else if(modifier === 'raster'){
                navigate('/raster/' + trajectory._id);
            }
        }

        prevActiveRef.current = activeModifiers;
    }, [activeModifiers, analysisConfig, structureIdentification, trajectory, logger]);

    const modifiers = [{
            Icon: PiLineSegmentThin,
            title: 'Dislocation Analysis', 
            modifierId: 'dislocation-analysis-config' 
        }, {
            Icon: TfiSlice,
            title: 'Slice Plane',
            modifierId: 'slice-plane' 
        }, {
            Icon: PiCirclesThreeLight,
            title: 'Common Neighbor Analysis', 
            modifierId: 'CNA' 
        }, {
            Icon: HiCubeTransparent,
            title: 'Polyhedral Template Matching', 
            modifierId: 'PTM' 
        }, {
            Icon: RiVipDiamondLine,
            title: 'Diamond Identifier',
            modifierId: 'DIAMOND'
        }, {
            Icon: IoIosStats,
            title: 'Analysis Metrics',
            modifierId: 'compute-analysis-differences',
            isLoading: !idRateSeries?.length,
            options: [{
                title: 'Total Dislocation Segments',
                modifierId: 'total-dislocation-segments'
            }, {
                title: 'Average Segment Length',
                modifierId: 'average-segment-length'
            }, {
                title: 'Identification Rate',
                modifierId: 'structure-identification-rate'
            }]
        }, {
            Icon: GrFormViewHide,
            title: 'Render Options',
            modifierId: 'render-options'
        }, {
            Icon: CiImageOn,
            title: 'Raster Frames',
            modifierId: 'raster'
        }
    ];

    return (
        <div className='editor-sidebar-scene-container'>
            <div className='editor-sidebar-scene-options-container'>
                {modifiers.map((option, index) => (
                    <CanvasSidebarOption
                        key={index}
                        option={option}
                        isLoading={option.isLoading}
                        activeOption={activeModifiers.includes(option.modifierId ? option.modifierId : '')}
                        onSelect={(option) => toggleModifiers(option.modifierId)} />
                ))}
            </div>
        </div>
    );
};

export default CanvasSidebarModifiers;