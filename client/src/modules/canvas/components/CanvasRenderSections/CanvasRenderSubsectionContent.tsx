import { Label, Slider, cn } from '@heroui/react';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import type { Subsection } from '@/modules/canvas/contracts/render-sections';

/**
 * What `CanvasRenderSections.css` used to do, and why none of it needs an ancestor
 * flag any more.
 *
 * All 25 of its rules were scoped to `.context-menu-submenu-panel`, the floating
 * panel `SubmenuItemWrapper` portals a render/camera submenu into, so the compact
 * canvas language could not leak to other Selects and Sliders. That scope turns out
 * to be exactly this component plus `CanvasRenderConfigHelpers`: the only two
 * renderers of a subsection are `CameraMenuPopover` and
 * `RenderMenuPopover/RenderGroupSubmenuContent`, and both render into that panel.
 * So the rules move onto the elements themselves rather than becoming
 * `[.context-menu-submenu-panel_&]:` variants (spec §5b.3) — same result, one less
 * indirection.
 *
 * The one rule that keeps a selector is the sibling gap: `.canvas-form-section +
 * .canvas-form-section { margin-top: 0.625rem }` applies both between the top-level
 * sections here and between the sections that `checkbox()` / `colorField()` emit
 * inside `section.extras`, so it stays a descendant+sibling arbitrary variant on the
 * content root and the marker class stays on the DOM for it to match.
 */
const SECTION_STACK_CLASS = '[&_.canvas-form-section+.canvas-form-section]:mt-2.5';

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
            <div className={cn(SECTION_STACK_CLASS, isSubDisabled && 'pointer-events-none opacity-45', className)}>
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
                                    <span className='text-[0.7rem] font-medium tracking-[0.01em] text-muted'>Enabled</span>
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
                                            <span className='min-w-0 flex-auto truncate text-[0.7rem] leading-6 tracking-[0.01em] text-muted'>{row.label}</span>
                                            <div className='flex flex-none flex-row items-center justify-end gap-1.5'>
                                                {/*
                                                  * `.context-menu-submenu-panel .canvas-form-control .slider`
                                                  * shrank bravais's 2.75rem-tall, 120px slider onto the 24px
                                                  * canvas row. HeroUI's Slider is a grid with a `label output`
                                                  * row above the track, so the row is collapsed by giving the
                                                  * Label `sr-only` — the accessible name the group's
                                                  * `aria-label` already carries visually, kept on the control
                                                  * itself because React Aria needs a named slider.
                                                  */}
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
                                                <span className='min-w-11 text-right text-[0.7rem] tabular-nums text-muted'>
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
