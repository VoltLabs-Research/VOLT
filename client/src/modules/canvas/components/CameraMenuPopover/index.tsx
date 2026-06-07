import useCameraGroup from '../CanvasRenderSections/groups/camera';
import CanvasRenderSubsectionContent from '../CanvasRenderSections/CanvasRenderSubsectionContent';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import { Button, Row, Stack, Tooltip } from '@voltstack/bravais';
import { Settings } from 'lucide-react';
import { useMemo } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';

import './CameraMenuPopover.css';

interface CameraMenuPopoverProps {
    compact?: boolean;
}

const CameraMenuPopover = ({ compact = false }: CameraMenuPopoverProps) => {
    const cameraGroup = useCameraGroup();

    const options = useMemo<MenuOption[]>(() => {
        return cameraGroup.subsections
            .filter((subsection) => subsection.visible !== false)
            .map((subsection) => ({
                label: subsection.label,
                submenuContent: (
                    <Stack gap='05' className="canvas-camera-menu-submenu">
                        <CanvasRenderSubsectionContent subsection={subsection} />
                    </Stack>
                )
            }));
    }, [cameraGroup.subsections]);

    return (
        <ContextMenuPopover
            id="viewport-camera-menu"
            trigger={compact ? (
                <span className='d-inline-flex flex-center'>
                    <Tooltip content="Camera" placement="bottom">
                        <Button
                            variant="ghost"
                            intent="canvas"
                            shape="rounded"
                            size="sm"
                            iconOnly
                            className="canvas-viewport-floating-btn"
                            aria-label="Camera settings"
                        >
                            <Settings size={14} />
                        </Button>
                    </Tooltip>
                </span>
            ) : (
                <Button
                    variant="ghost"
                    intent="canvas"
                    shape="rounded"
                    size="sm"
                    className="font-size-05 canvas-btn-compact"
                    leftIcon={<Row as='span' justify='center' shrink='0'><Settings size={12} /></Row>}
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
