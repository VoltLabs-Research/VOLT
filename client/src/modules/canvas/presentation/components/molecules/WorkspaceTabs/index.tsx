import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import IconButton from '@/shared/presentation/components/IconButton';

const workspaces = [
    { id: 'layout', label: 'Layout' },
    { id: 'modeling', label: 'Modeling' },
    { id: 'sculpting', label: 'Sculpting' },
    { id: 'uv', label: 'UV Editing' },
    { id: 'texture', label: 'Texture Paint' },
    { id: 'shading', label: 'Shading' },
    { id: 'animation', label: 'Animation' },
    { id: 'rendering', label: 'Rendering' }
];

interface WorkspaceTabsProps {
    activeWorkspace: string;
    onSelect: (id: string) => void;
}

const WorkspaceTabs = ({ activeWorkspace, onSelect }: WorkspaceTabsProps) => (
    <Container className="d-flex items-center px-025" role="tablist" aria-label="Workspaces">
        {workspaces.map((ws) => (
            <Button
                key={ws.id}
                role="tab"
                aria-selected={activeWorkspace === ws.id}
                onClick={() => onSelect(ws.id)}
                variant={activeWorkspace === ws.id ? 'solid' : 'ghost'}
                intent="canvas"
                shape="rounded"
                size="sm"
                className="font-size-05 canvas-btn-compact"
            >
                {ws.label}
            </Button>
        ))}
        <IconButton variant="ghost" size="sm" aria-label="Add workspace">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        </IconButton>
    </Container>
);

export default WorkspaceTabs;
