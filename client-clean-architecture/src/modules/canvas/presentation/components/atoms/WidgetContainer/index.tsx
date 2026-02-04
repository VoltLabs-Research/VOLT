import { forwardRef, type ReactNode, type CSSProperties } from 'react';
import useSceneInteraction from '@/modules/canvas/presentation/hooks/use-scene-interaction';
import '@/modules/canvas/presentation/components/atoms/WidgetContainer/WidgetContainer.css';

interface WidgetContainerProps {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
}

const WidgetContainer = forwardRef<HTMLDivElement, WidgetContainerProps>(
    ({ children, className = '', style }, ref) => {
        const isSceneInteracting = useSceneInteraction();
        
        return (
            <div
                ref={ref}
                className={`widget-container p-absolute radius-lg color-secondary ${isSceneInteracting ? 'dimmed' : ''} ${className}`}
                style={style}
            >
                {children}
            </div>
        );
    }
);

WidgetContainer.displayName = 'WidgetContainer';

export default WidgetContainer;
