import useCanvasUrlState, { CanvasWorkspace } from '../../../hooks/use-canvas-url-state';
import { useNavigate } from 'react-router-dom';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import WorkspacePeerAvatars from '../WorkspacePeerAvatars';

import type { WorkspacePresenceUser } from '@/modules/canvas/collaboration/use-canvas-workspace';

interface WorkspaceTabsProps {
    disableAuxWorkspaces?: boolean;
    peers?: WorkspacePresenceUser[];
    self?: WorkspacePresenceUser;
    activeOwnerId?: string;
    onSelectPeer?: (peerId: string) => void;
};

const WorkspaceTabs = ({
    disableAuxWorkspaces = false,
    peers = [],
    self,
    activeOwnerId,
    onSelectPeer
}: WorkspaceTabsProps) => {
    const navigate = useNavigate();
    const { activeWorkspace, setActiveWorkspace } = useCanvasUrlState();
    const isRaster = activeWorkspace === CanvasWorkspace.Raster;
    const isScripting = activeWorkspace === CanvasWorkspace.Scripting;
    const canShowPeers = Boolean(onSelectPeer && (peers.length > 0 || self));

    return (
        <Container className="d-flex items-center px-1 gap-025 canvas-workspace-tabs">
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
            {canShowPeers && (
                <WorkspacePeerAvatars
                    peers={peers}
                    self={self}
                    activeOwnerId={activeOwnerId}
                    onSelectPeer={onSelectPeer!}
                />
            )}
        </Container>
    );
};

export default WorkspaceTabs;
