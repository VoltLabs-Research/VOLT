import useCanvasUrlState, { CanvasWorkspace } from '../../hooks/use-canvas-url-state';
import { useNavigate } from 'react-router-dom';
import Button from '@/shared/presentation/components/Button';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import { Check, ChevronDown } from 'lucide-react';

interface WorkspaceTabsProps {
    disableAuxWorkspaces?: boolean;
};

const WORKSPACE_LABEL: Record<CanvasWorkspace, string> = {
    [CanvasWorkspace.Modeling]: 'Scene',
    [CanvasWorkspace.Raster]: 'Raster',
    [CanvasWorkspace.Scripting]: 'Scripting'
};

const WorkspaceTabs = ({ disableAuxWorkspaces = false }: WorkspaceTabsProps) => {
    const navigate = useNavigate();
    const { activeWorkspace, setActiveWorkspace } = useCanvasUrlState();

    const activeIcon = <Check size={12} />;
    const iconSlot = <span style={{ width: 12, height: 12, display: 'inline-block' }} />;

    return (
        <div className="volt-container d-flex items-center px-1 gap-025 canvas-workspace-tabs">
            <Popover
                id="canvas-workspace-switcher"
                role="menu"
                triggerAriaHaspopup="menu"
                ariaLabel="Switch workspace"
                placement="bottom-start"
                noPadding
                trigger={(
                    <Button
                        variant="ghost"
                        intent="canvas"
                        size="sm"
                        shape="rounded"
                        className="font-size-1 canvas-btn-compact"
                        style={{ padding: 0 }}
                        rightIcon={<span className="d-flex items-center content-center f-shrink-0"><ChevronDown size={12} /></span>}
                    >
                        {WORKSPACE_LABEL[activeWorkspace]}
                    </Button>
                )}
            >
                {(close) => (
                    <PopoverMenu label="Switch workspace" onClose={close}>
                        <PopoverMenuItem
                            size="sm"
                            rightAdornment={iconSlot}
                            onClick={() => {
                                navigate('/dashboard');
                                close();
                            }}
                        >
                            Dashboard
                        </PopoverMenuItem>
                        <PopoverMenuItem
                            size="sm"
                            rightAdornment={activeWorkspace === CanvasWorkspace.Modeling ? activeIcon : iconSlot}
                            onClick={() => {
                                setActiveWorkspace(CanvasWorkspace.Modeling);
                                close();
                            }}
                        >
                            Scene
                        </PopoverMenuItem>
                        <PopoverMenuItem
                            size="sm"
                            disabled={disableAuxWorkspaces}
                            rightAdornment={activeWorkspace === CanvasWorkspace.Raster ? activeIcon : iconSlot}
                            onClick={() => {
                                setActiveWorkspace(CanvasWorkspace.Raster);
                                close();
                            }}
                        >
                            Raster
                        </PopoverMenuItem>
                        <PopoverMenuItem
                            size="sm"
                            disabled={disableAuxWorkspaces}
                            rightAdornment={activeWorkspace === CanvasWorkspace.Scripting ? activeIcon : iconSlot}
                            onClick={() => {
                                setActiveWorkspace(CanvasWorkspace.Scripting);
                                close();
                            }}
                        >
                            Scripting
                        </PopoverMenuItem>
                    </PopoverMenu>
                )}
            </Popover>
        </div>
    );
};

export default WorkspaceTabs;
