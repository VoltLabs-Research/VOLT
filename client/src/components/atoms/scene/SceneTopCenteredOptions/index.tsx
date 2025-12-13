import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import EditorWidget from '@/components/organisms/scene/EditorWidget';
import Select from '@/components/atoms/form/Select';
import { useNavigate } from 'react-router';
import { LuLayoutDashboard } from "react-icons/lu";
import { GrHomeRounded } from "react-icons/gr";
import { MdOutlineLightMode } from "react-icons/md";
import { TbAugmentedReality2 } from "react-icons/tb";
import { GoDownload } from "react-icons/go";
import { CiShare1 } from "react-icons/ci";
import type { Scene3DRef } from '@/components/organisms/scene/Scene3D';
import './SceneTopCenteredOptions.css';

const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200];

interface SceneTopCenteredOptionsProps {
    scene3DRef?: React.RefObject<Scene3DRef>;
}

const SceneTopCenteredOptions = ({ scene3DRef }: SceneTopCenteredOptionsProps) => {
    const navigate = useNavigate();
    const [currentZoom, setCurrentZoom] = useState('100');
    const lastZoomRef = useRef<number>(100);

    // Update selector when zoom changes via touchpad
    useEffect(() => {
        let rafId: number | null = null;

        const updateZoom = () => {
            try{
                if(!scene3DRef?.current?.getCurrentZoom){
                    rafId = requestAnimationFrame(updateZoom);
                    return;
                }

                const newZoom = scene3DRef.current.getCurrentZoom();

                // Only update if zoom changed significantly(more than 1%)
                if(Math.abs(newZoom - lastZoomRef.current) > 1) {
                    lastZoomRef.current = newZoom;
                    // Find closest preset
                    const closest = ZOOM_PRESETS.reduce((prev, curr) =>
                        Math.abs(curr - newZoom) < Math.abs(prev - newZoom) ? curr : prev
                    );
                    setCurrentZoom(closest.toString());
                }
            }catch(error){
                console.error('Error updating zoom:', error);
            }

            rafId = requestAnimationFrame(updateZoom);
        };

        rafId = requestAnimationFrame(updateZoom);

        return() => {
            if(rafId !== null){
                cancelAnimationFrame(rafId);
            }
        };
    }, [scene3DRef]);

    const zoomOptions = useMemo(() =>
        ZOOM_PRESETS.map(preset => ({
            value: preset.toString(),
            title: `${preset}%`
        })),
        []
    );

    const handleZoomChange = useCallback((zoomPercentStr: string) => {
        setCurrentZoom(zoomPercentStr);
        const zoomPercent = parseInt(zoomPercentStr, 10);
        lastZoomRef.current = zoomPercent;

        // Use scene3DRef to zoom via OrbitControls if available
        if(scene3DRef?.current?.zoomTo){
            scene3DRef.current.zoomTo(zoomPercent);
        }
    }, [scene3DRef]);

    return(
        <EditorWidget className='editor-top-centered-options-container' draggable={false}>
            {[
                [GrHomeRounded, () => navigate('/dashboard')],
                [MdOutlineLightMode, () => {}],
                [LuLayoutDashboard, () => {}]
            ].map((item, index) => {
                const [Icon, callback] = item as [any, () => void];
                return(
                    <i
                        onClick={callback}
                        className={'editor-sidebar-scene-option-icon-container '.concat((index === 0) ? 'selected' : '')}
                        key={index}
                    >
                        <Icon />
                    </i>
                );
            })}

            <div className='editor-scene-zoom-selector-wrapper'>
                <Select
                    options={zoomOptions}
                    value={currentZoom}
                    onChange={handleZoomChange}
                    placeholder='Zoom'
                    onDark
                    className='editor-scene-zoom-selector'
                    maxListWidth={200}
                />
            </div>

            {[
                [TbAugmentedReality2, () => {}],
                [GoDownload, () => {}],
                [CiShare1, () => {}]
            ].map((item, index) => {
                const [Icon] = item as [any, () => void];
                return(
                    <i className={'editor-sidebar-scene-option-icon-container '.concat((index === 0) ? 'selected' : '')} key={index}>
                        <Icon />
                    </i>
                );
            })}
        </EditorWidget>
    );
};

export default SceneTopCenteredOptions;
