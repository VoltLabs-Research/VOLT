import CanvasRenderSubsectionContent from '../../organisms/CanvasRenderSections/CanvasRenderSubsectionContent';
import Container from '@/shared/presentation/components/Container';
import type { RenderGroup } from '../../organisms/CanvasRenderSections/types';

interface RenderGroupSubmenuContentProps {
    group: RenderGroup;
};

const RenderGroupSubmenuContent = ({ group }: RenderGroupSubmenuContentProps) => {
    const visibleSubsections = group.subsections.filter((subsection) => subsection.visible !== false);
    const showSubsectionLabels = visibleSubsections.length > 1;

    return (
        <Container className="canvas-render-menu-submenu d-flex column">
            {visibleSubsections.map((subsection, index) => (
                <Container key={`${group.id}-${subsection.label}-${index}`} className="canvas-render-menu-submenu-section d-flex column gap-05">
                    {showSubsectionLabels && (
                        <span className="canvas-render-menu-submenu-title font-size-05 font-weight-6 color-muted">
                            {subsection.label}
                        </span>
                    )}
                    <CanvasRenderSubsectionContent subsection={subsection} className="canvas-render-menu-submenu-body" />
                </Container>
            ))}
        </Container>
    );
};

export default RenderGroupSubmenuContent;
