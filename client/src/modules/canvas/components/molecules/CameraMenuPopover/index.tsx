import useCameraGroup from '../../organisms/CanvasRenderSections/groups/camera';
import CanvasRenderSubsectionContent from '../../organisms/CanvasRenderSections/CanvasRenderSubsectionContent';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import Button from '@/shared/presentation/components/Button';
import { Settings } from 'lucide-react';
import { useMemo } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';

import './CameraMenuPopover.css';

const CameraMenuPopover = () => {
    const cameraGroup = useCameraGroup();

    const options = useMemo<MenuOption[]>(() => {
        return cameraGroup.subsections
            .filter((subsection) => subsection.visible !== false)
            .map((subsection) => ({
                label: subsection.label,
                submenuContent: (
                    <div className="canvas-camera-menu-submenu d-flex column gap-05">
                        <CanvasRenderSubsectionContent subsection={subsection} />
                    </div>
                )
            }));
    }, [cameraGroup.subsections]);

    return (
        <ContextMenuPopover
            id="viewport-camera-menu"
            trigger={(
                <Button
                    variant="ghost"
                    intent="canvas"
                    shape="rounded"
                    size="sm"
                    className="font-size-05 canvas-btn-compact"
                    leftIcon={<span className="d-flex items-center content-center f-shrink-0"><Settings size={12} /></span>}
                    aria-label="Camera settings"
                    title="Camera settings"
                >
                    Camera
                </Button>
            )}
            options={options}
            triggerAction="click"
            ariaLabel="Camera settings"
            menuLabel="Camera settings"
            size="sm"
        />
    );
};

export default CameraMenuPopover;
