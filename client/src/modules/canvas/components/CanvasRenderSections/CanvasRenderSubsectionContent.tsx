import { Label, Slider, cn } from '@heroui/react';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import type { Subsection } from '@/modules/canvas/contracts/render-sections';

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

    return (
        <>
            {isSubDisabled && subDisabledReason && (
                <div className='text-xs italic text-muted'>
                    {subDisabledReason}
                </div>
            )}
            <div className={cn('[&_.canvas-form-section+.canvas-form-section]:mt-2.5', isSubDisabled && 'pointer-events-none opacity-45', className)}>
                {subsection.sections.map((section) => {
                    const isSectionDisabled = isSubDisabled || section.disabled === true;
                    const sectionDisabledReason = !isSubDisabled ? section.disabledReason : undefined;

                    return (
                        <div className={cn('canvas-form-section flex flex-col gap-2', isSectionDisabled && 'opacity-60')} key={section.key}>
                            {sectionDisabledReason && (
                                <div className='text-xs italic text-muted'>
                                    {sectionDisabledReason}
                                </div>
                            )}
                            {section.onToggle && (
                                <div className='flex min-h-6 flex-row items-center justify-between' role='group' aria-label={`${section.key} toggle`}>
                                    <span className='text-2xs font-medium tracking-[0.01em] text-muted'>Enabled</span>
                                    <FormFieldRHF
                                        fieldValue={section.enabled}
                                        fieldKey={`${section.key}-enabled`}
                                        fieldType='checkbox'
                                        onFieldChange={(_, next) => section.onToggle?.(Boolean(next))}
                                        variant='inline'
                                    />
                                </div>
                            )}
                            <div className={cn('flex flex-col gap-2', isSectionDisabled && 'pointer-events-none opacity-45')}>
                                {section.rows.map((row) => {
                                    const value = 'get' in row ? row.get() : row.value;
                                    const onChange = 'set' in row ? row.set : row.onChange;

                                    return (
                                        <div className={cn('flex min-h-6 flex-row items-center justify-between gap-2', row.className)} key={`${section.key}-${row.label}`} role='group' aria-label={row.label}>
                                            <span className='min-w-0 flex-auto truncate text-2xs leading-6 tracking-[0.01em] text-muted'>{row.label}</span>
                                            <div className='flex flex-none flex-row items-center justify-end gap-1.5'>
                                                <Slider
                                                    className='w-24 min-h-5 py-1'
                                                    minValue={row.min}
                                                    maxValue={row.max}
                                                    step={row.step ?? 1}
                                                    value={value}
                                                    onChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
                                                >
                                                    <Label className='sr-only'>{row.label}</Label>
                                                    <Slider.Track className='min-w-24'>
                                                        <Slider.Fill />
                                                        <Slider.Thumb />
                                                    </Slider.Track>
                                                </Slider>
                                                <span className='min-w-11 text-right text-2xs tabular-nums text-muted'>
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
