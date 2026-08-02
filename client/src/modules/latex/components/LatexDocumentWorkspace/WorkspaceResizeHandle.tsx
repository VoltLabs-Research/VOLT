import { PANEL_DESCRIPTORS } from './use-latex-panel-layout';
import type { LatexPanelKey, PanelLayout } from './use-latex-panel-layout';

interface WorkspaceResizeHandleProps {
    panel: LatexPanelKey;
    layout: PanelLayout;
}

/** Keyboard and pointer accessible separator that resizes one workspace panel. */
const WorkspaceResizeHandle = ({ panel, layout }: WorkspaceResizeHandleProps) => {
    const descriptor = PANEL_DESCRIPTORS[panel];
    const isHorizontalTravel = descriptor.axis === 'x';

    return (
        <div
            className={descriptor.className}
            role='separator'
            aria-label={descriptor.label}
            aria-orientation={isHorizontalTravel ? 'vertical' : 'horizontal'}
            aria-controls={descriptor.controls}
            aria-valuemin={descriptor.min}
            aria-valuemax={descriptor.max ?? undefined}
            aria-valuenow={layout.panelWidths[descriptor.widthKey]}
            tabIndex={0}
            onPointerDown={(event) => layout.resize.onPointerDown(panel, event)}
            onPointerMove={layout.resize.onPointerMove}
            onPointerUp={layout.resize.onPointerUp}
            onPointerCancel={layout.resize.onPointerCancel}
            onKeyDown={(event) => layout.resize.onKeyDown(panel, event)}
        >
            <span
                className={`latex-drag-handle__grip volt-resize-handle__grip volt-resize-handle__grip--${isHorizontalTravel ? 'horizontal' : 'vertical'}`}
                aria-hidden='true'
            />
        </div>
    );
};

export default WorkspaceResizeHandle;
