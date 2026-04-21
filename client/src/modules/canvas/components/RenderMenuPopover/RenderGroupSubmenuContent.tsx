import CanvasRenderSubsectionContent from '../CanvasRenderSections/CanvasRenderSubsectionContent';
import type { RenderGroup } from '../CanvasRenderSections/types';

interface RenderGroupSubmenuContentProps {
    group: RenderGroup;
};

const RenderGroupSubmenuContent = ({ group }: RenderGroupSubmenuContentProps) => {
    const visibleSubsections = group.subsections.filter((subsection) => subsection.visible !== false);
    const showSubsectionLabels = visibleSubsections.length > 1;

    return (
        <div className="volt-container canvas-render-menu-submenu d-flex column">
            {visibleSubsections.map((subsection, index) => (
                <div key={`${group.id}-${subsection.label}-${index}`} className="volt-container canvas-render-menu-submenu-section d-flex column gap-05">
                    {showSubsectionLabels && (
                        <span className="canvas-render-menu-submenu-title font-size-05 font-weight-6 color-muted">
                            {subsection.label}
                        </span>
                    )}
                    <CanvasRenderSubsectionContent subsection={subsection} className="canvas-render-menu-submenu-body" />
                </div>
            ))}
        </div>
    );
};

export default RenderGroupSubmenuContent;
