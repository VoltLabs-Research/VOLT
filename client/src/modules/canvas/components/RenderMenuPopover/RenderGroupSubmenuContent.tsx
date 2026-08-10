import CanvasRenderSubsectionContent from '../CanvasRenderSections/CanvasRenderSubsectionContent';
import type { RenderGroup } from '@/modules/canvas/contracts/render-sections';

interface RenderGroupSubmenuContentProps {
    group: RenderGroup;
}

const RenderGroupSubmenuContent = ({ group }: RenderGroupSubmenuContentProps) => {
    const visibleSubsections = group.subsections.filter((subsection) => subsection.visible !== false);
    const showSubsectionLabels = visibleSubsections.length > 1;

    return (
        <div className='flex flex-col canvas-render-menu-submenu'>
            {visibleSubsections.map((subsection, index) => (
                <div className='flex flex-col gap-2 canvas-render-menu-submenu-section' key={`${group.id}-${subsection.label}-${index}`}>
                    {showSubsectionLabels && (
                        <span className='text-xs font-semibold uppercase tracking-[0.05em] text-muted'>{subsection.label}</span>
                    )}
                    <CanvasRenderSubsectionContent subsection={subsection} className="canvas-render-menu-submenu-body" />
                </div>
            ))}
        </div>
    );
};

export default RenderGroupSubmenuContent;
