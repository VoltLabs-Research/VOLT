import Container from '@/shared/presentation/components/Container';
import type { ResizeDirection } from '../../../hooks/use-resizable';
import './ResizeHandle.css';

interface ResizeHandleProps {
    direction: ResizeDirection;
    isDragging: boolean;
    onPointerDown: (e: React.PointerEvent) => void;
}

const ResizeHandle = ({ direction, isDragging, onPointerDown }: ResizeHandleProps) => (
    <Container
        className={`canvas-resize-handle z-5 canvas-resize-handle--${direction}${isDragging ? ' canvas-resize-handle--active' : ''}`}
        onPointerDown={onPointerDown}
    />
);

export default ResizeHandle;
