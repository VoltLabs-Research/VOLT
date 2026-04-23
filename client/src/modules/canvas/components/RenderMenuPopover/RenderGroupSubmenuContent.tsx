import CanvasRenderSubsectionContent from '../CanvasRenderSections/CanvasRenderSubsectionContent';
import { Stack, SectionLabel } from '@/shared/presentation/primitives';
import type { RenderGroup } from '../CanvasRenderSections/types';

interface RenderGroupSubmenuContentProps {
    group: RenderGroup;
};

const RenderGroupSubmenuContent = ({ group }: RenderGroupSubmenuContentProps) => {
    const visibleSubsections = group.subsections.filter((subsection) => subsection.visible !== false);
    const showSubsectionLabels = visibleSubsections.length > 1;

    return (
        <Stack className="canvas-render-menu-submenu">
            {visibleSubsections.map((subsection, index) => (
                <Stack key={`${group.id}-${subsection.label}-${index}`} gap='05' className="canvas-render-menu-submenu-section">
                    {showSubsectionLabels && (
                        <SectionLabel>{subsection.label}</SectionLabel>
                    )}
                    <CanvasRenderSubsectionContent subsection={subsection} className="canvas-render-menu-submenu-body" />
                </Stack>
            ))}
        </Stack>
    );
};

export default RenderGroupSubmenuContent;
