import CanvasRenderSubsectionContent from '../CanvasRenderSections/CanvasRenderSubsectionContent';
import type { RenderGroup } from '@/modules/canvas/contracts/render-sections';

interface RenderGroupSubmenuContentProps {
    group: RenderGroup;
}

const RenderGroupSubmenuContent = ({ group }: RenderGroupSubmenuContentProps) => {
    const visibleSubsections = group.subsections.filter((subsection) => subsection.visible !== false);
    const showSubsectionLabels = visibleSubsections.length > 1;

    return (
        <div className='flex min-w-[320px] flex-col px-2 py-1'>
            {visibleSubsections.map((subsection, index) => (
                <div
                    className='flex flex-col gap-2 not-first:mt-3 not-first:border-t not-first:border-border not-first:pt-3'
                    key={`${group.id}-${subsection.label}-${index}`}
                >
                    {showSubsectionLabels && (
                        <span className='text-xs font-semibold uppercase tracking-[0.05em] text-muted'>{subsection.label}</span>
                    )}
                    <CanvasRenderSubsectionContent subsection={subsection} />
                </div>
            ))}
        </div>
    );
};

export default RenderGroupSubmenuContent;
