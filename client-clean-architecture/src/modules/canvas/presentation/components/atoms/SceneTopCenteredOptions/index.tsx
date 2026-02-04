import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuLayoutDashboard } from 'react-icons/lu';
import { GrHomeRounded } from 'react-icons/gr';
import { MdOutlineLightMode } from 'react-icons/md';
import { TbAugmentedReality2 } from 'react-icons/tb';
import { GoDownload } from 'react-icons/go';
import { CiShare1 } from 'react-icons/ci';
import EditorWidget from '@/modules/canvas/presentation/components/organisms/EditorWidget';
import Select from '@/shared/presentation/components/Select';
import Tooltip from '@/shared/presentation/components/Tooltip';
import type { FractalSceneRef } from '@/modules/fractal/presentation/components/FractalScene';
import '@/modules/canvas/presentation/components/atoms/SceneTopCenteredOptions/SceneTopCenteredOptions.css';

const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200];

interface SceneTopCenteredOptionsProps {
    scene3DRef?: React.RefObject<FractalSceneRef>;
}

const SceneTopCenteredOptions = ({ scene3DRef }: SceneTopCenteredOptionsProps) => {
    const navigate = useNavigate();
    const [currentZoom, setCurrentZoom] = useState('100');
    const lastZoomRef = useRef<number>(100);

    useEffect(() => {
        let rafId: number | null = null;

        const updateZoom = () => {
            try {
                if (!scene3DRef?.current?.getCurrentZoom) {
                    rafId = requestAnimationFrame(updateZoom);
                    return;
                }

                const newZoom = scene3DRef.current.getCurrentZoom();

                if (Math.abs(newZoom - lastZoomRef.current) > 1) {
                    lastZoomRef.current = newZoom;
                    const closest = ZOOM_PRESETS.reduce((prev, curr) =>
                        Math.abs(curr - newZoom) < Math.abs(prev - newZoom) ? curr : prev
                    );
                    setCurrentZoom(closest.toString());
                }
            } catch (error) {
                console.error('Error updating zoom:', error);
            }

            rafId = requestAnimationFrame(updateZoom);
        };

        rafId = requestAnimationFrame(updateZoom);

        return () => {
            if (rafId !== null) {
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

        if (scene3DRef?.current?.zoomTo) {
            scene3DRef.current.zoomTo(zoomPercent);
        }
    }, [scene3DRef]);

    const leftIcons = [
        { Icon: GrHomeRounded, tooltip: 'Go to Dashboard', callback: () => navigate('/dashboard') },
        { Icon: MdOutlineLightMode, tooltip: 'Toggle Theme', callback: () => { } },
        { Icon: LuLayoutDashboard, tooltip: 'Layout', callback: () => { } }
    ];

    const rightIcons = [
        { Icon: TbAugmentedReality2, tooltip: 'AR View', callback: () => { } },
        { Icon: GoDownload, tooltip: 'Download', callback: () => { } },
        { Icon: CiShare1, tooltip: 'Share', callback: () => { } }
    ];

    return (
        <EditorWidget className='d-flex items-center gap-1 row editor-top-centered-options-container p-absolute' draggable={false}>
            {leftIcons.map((item, index) => (
                <Tooltip key={index} content={item.tooltip} placement="bottom">
                    <i
                        onClick={item.callback}
                        className={'editor-sidebar-scene-option-icon-container '.concat((index === 0) ? 'selected' : '')}
                    >
                        <item.Icon />
                    </i>
                </Tooltip>
            ))}

            <div className='editor-scene-zoom-selector-wrapper p-relative'>
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

            {rightIcons.map((item, index) => (
                <Tooltip key={index} content={item.tooltip} placement="bottom">
                    <i
                        onClick={item.callback}
                        className={'editor-sidebar-scene-option-icon-container '.concat((index === 0) ? 'selected' : '')}
                    >
                        <item.Icon />
                    </i>
                </Tooltip>
            ))}
        </EditorWidget>
    );
};

export default SceneTopCenteredOptions;
