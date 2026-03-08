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
                className="font-size-05 canvas-btn-compact"
                onClick={() => navigate('/dashboard')}
            >
                Dashboard
            </Button>
            <Button
                variant={isScripting ? 'ghost' : 'solid'}
                intent="canvas"
                size="sm"
                shape="rounded"
                className="font-size-05 canvas-btn-compact"
                onClick={() => setActiveWorkspace('modeling')}
            >
                Scene
            </Button>
            <Button
                variant={isScripting ? 'solid' : 'ghost'}
                intent="canvas"
                size="sm"
                shape="rounded"
                className="font-size-05 canvas-btn-compact"
                onClick={() => setActiveWorkspace('scripting')}
            >
                Scripting
            </Button>
        </Container>
    );
};

export default WorkspaceTabs;
