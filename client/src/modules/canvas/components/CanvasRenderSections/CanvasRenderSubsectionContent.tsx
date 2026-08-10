import { cn } from '@heroui/react';
import { Slider } from '@voltstack/bravais';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import type { Subsection } from '@/modules/canvas/contracts/render-sections';

import './CanvasRenderSections.css';

interface CanvasRenderSubsectionContentProps {
    subsection: Subsection;
    className?: string;
}

const CanvasRenderSubsectionContent = ({
    subsection,
    className = ''
}: CanvasRenderSubsectionContentProps) => {
    const isSubDisabled = subsection.disabled === true;
    const subDisabledReason = subsection.disabledReason;
    const contentClassName = [
        className,
        isSubDisabled ? 'canvas-render-disabled-content' : ''
    ].filter(Boolean).join(' ');

    return (
        <>
            {isSubDisabled && subDisabledReason && (
                <div className='text-xs canvas-render-disabled-reason'>
                    {subDisabledReason}
                </div>
            )}
            <div className={contentClassName || undefined}>
                {subsection.sections.map((section) => {
                    const isSectionDisabled = isSubDisabled || section.disabled === true;
                    const sectionDisabledReason = !isSubDisabled ? section.disabledReason : undefined;

                    return (
                        <div className={cn('flex flex-col gap-2', `canvas-form-section${isSectionDisabled ? ' canvas-render-disabled' : ''}`)} key={section.key}>
                            {sectionDisabledReason && (
                                <div className='text-xs canvas-render-disabled-reason'>
                                    {sectionDisabledReason}
                                </div>
                            )}
                            {section.onToggle && (
                                <div className='flex flex-row items-center justify-between canvas-form-section-header' role="group" aria-label={`${section.key} toggle`}>
                                    <span className='text-xs font-medium canvas-form-section-title'>Enabled</span>
                                    <FormFieldRHF
                                        fieldValue={section.enabled}
                                        fieldKey={`${section.key}-enabled`}
                                        fieldType="checkbox"
                                        onFieldChange={(_, next) => section.onToggle?.(Boolean(next))}
                                        variant="inline"
                                    />
                                </div>
                            )}
                            <div className={cn('flex flex-col gap-2', isSectionDisabled ? 'canvas-render-disabled-content' : undefined)}>
                                {section.rows.map((row) => {
                                    const value = 'get' in row ? row.get() : row.value;
                                    const onChange = 'set' in row ? row.set : row.onChange;

                                    return (
                                        <div className={cn('flex flex-row items-center justify-between gap-2', `canvas-form-row ${row.className ?? ''}`)} key={`${section.key}-${row.label}`} role="group" aria-label={row.label}>
                                            <span className='text-xs canvas-form-label'>{row.label}</span>
                                            <div className='flex flex-row items-center gap-[0.2rem] canvas-form-control'>
                                                <Slider
                                                    min={row.min}
                                                    max={row.max}
                                                    step={row.step ?? 1}
                                                    value={value}
                                                    onChange={onChange}
                                                />
                                                <span className='text-xs canvas-form-value'>
                                                    {row.format?.(value) ?? value}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {section.extras}
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
};

export default CanvasRenderSubsectionContent;
