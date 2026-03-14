import useCanvasUrlState from '../../../hooks/use-canvas-url-state';

import { useNavigate } from 'react-router-dom';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';

const WorkspaceTabs = () => {
    const navigate = useNavigate();
    const { activeWorkspace, setActiveWorkspace } = useCanvasUrlState();
    const isScripting = activeWorkspace === 'scripting';

    return (
        <Container className="d-flex items-center px-1 gap-025">
            <Button
                variant="ghost"
                intent="canvas"
                size="sm"
                shape="rounded"
                className="font-size-075 canvas-btn-compact"
                onClick={() => navigate('/dashboard')}
            >
                Dashboard
            </Button>
            <Container className="d-flex items-center gap-025" role="tablist" aria-label="Canvas workspaces">
                <Button
                    variant={isScripting ? 'ghost' : 'solid'}
                    intent="canvas"
                    size="sm"
                    shape="rounded"
                    className="font-size-075 canvas-btn-compact"
                    role="tab"
                    aria-selected={!isScripting}
                    onClick={() => setActiveWorkspace('modeling')}
                >
                    Scene
                </Button>
                <Button
                    variant={isScripting ? 'solid' : 'ghost'}
                    intent="canvas"
                    size="sm"
                    shape="rounded"
                    className="font-size-075 canvas-btn-compact"
                    role="tab"
                    aria-selected={isScripting}
                    onClick={() => setActiveWorkspace('scripting')}
                >
                    Scripting
                </Button>
            </Container>
        </Container>
    );
};

export default WorkspaceTabs;
