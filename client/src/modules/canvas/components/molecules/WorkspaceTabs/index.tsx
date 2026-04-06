import useCanvasUrlState, { CanvasWorkspace } from '../../../hooks/use-canvas-url-state';
import { useNavigate } from 'react-router-dom';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';

interface WorkspaceTabsProps {
    disableAuxWorkspaces?: boolean;
};

const WorkspaceTabs = ({ disableAuxWorkspaces = false }: WorkspaceTabsProps) => {
    const navigate = useNavigate();
    const { activeWorkspace, setActiveWorkspace } = useCanvasUrlState();
    const isRaster = activeWorkspace === CanvasWorkspace.Raster;
    const isScripting = activeWorkspace === CanvasWorkspace.Scripting;

    return (
        <Container className="d-flex items-center px-1 gap-025">
            <Button
                variant="ghost"
                intent="canvas"
                size="sm"
                shape="rounded"
                className="font-size-1 canvas-btn-compact"
                onClick={() => navigate('/dashboard')}
            >
                Dashboard
            </Button>
            <Container className="d-flex items-center gap-025" role="tablist" aria-label="Canvas workspaces">
                <Button
                    variant={!isRaster && !isScripting ? 'solid' : 'ghost'}
                    intent="canvas"
                    size="sm"
                    shape="rounded"
                    className="font-size-1 canvas-btn-compact"
                    role="tab"
                    aria-selected={!isRaster && !isScripting}
                    onClick={() => setActiveWorkspace(CanvasWorkspace.Modeling)}
                >
                    Scene
                </Button>
                <Button
                    variant={isRaster ? 'solid' : 'ghost'}
                    intent="canvas"
                    size="sm"
                    shape="rounded"
                    className="font-size-1 canvas-btn-compact"
                    role="tab"
                    aria-selected={isRaster}
                    disabled={disableAuxWorkspaces}
                    onClick={() => setActiveWorkspace(CanvasWorkspace.Raster)}
                >
                    Raster
                </Button>
                <Button
                    variant={isScripting ? 'solid' : 'ghost'}
                    intent="canvas"
                    size="sm"
                    shape="rounded"
                    className="font-size-1 canvas-btn-compact"
                    role="tab"
                    aria-selected={isScripting}
                    disabled={disableAuxWorkspaces}
                    onClick={() => setActiveWorkspace(CanvasWorkspace.Scripting)}
                >
                    Scripting
                </Button>
            </Container>
        </Container>
    );
};

export default WorkspaceTabs;
