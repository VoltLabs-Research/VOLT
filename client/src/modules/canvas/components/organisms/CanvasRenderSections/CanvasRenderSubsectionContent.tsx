import CanvasSlider from '../../atoms/CanvasSlider';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import type { Subsection } from './types';

interface CanvasRenderSubsectionContentProps {
    subsection: Subsection;
    className?: string;
};

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
                <Container className="canvas-render-disabled-reason font-size-05">
                    {subDisabledReason}
                </Container>
            )}
            <Container className={contentClassName || undefined}>
                {subsection.sections.map((section) => {
                    const isSectionDisabled = isSubDisabled || section.disabled === true;
                    const sectionDisabledReason = !isSubDisabled ? section.disabledReason : undefined;

                    return (
                        <Container key={section.key} className={`canvas-form-section d-flex column gap-05${isSectionDisabled ? ' canvas-render-disabled' : ''}`}>
                            {sectionDisabledReason && (
                                <Container className="canvas-render-disabled-reason font-size-05">
                                    {sectionDisabledReason}
                                </Container>
                            )}
                            {section.onToggle && (
                                <Container className="canvas-form-section-header d-flex items-center content-between" role="group" aria-label={`${section.key} toggle`}>
                                    <span className="canvas-form-section-title font-weight-5 font-size-1">Enabled</span>
                                    <FormFieldRHF
                                        fieldValue={section.enabled}
                                        fieldKey={`${section.key}-enabled`}
                                        fieldType="checkbox"
                                        onFieldChange={(_, next) => section.onToggle?.(Boolean(next))}
                                        variant="inline"
                                    />
                                </Container>
                            )}
                            <Container className={`d-flex column gap-05${isSectionDisabled ? ' canvas-render-disabled-content' : ''}`}>
                                {section.rows.map((row) => {
                                    const value = 'get' in row ? row.get() : row.value;
                                    const onChange = 'set' in row ? row.set : row.onChange;

                                    return (
                                        <Container
                                            key={`${section.key}-${row.label}`}
                                            className={`canvas-form-row d-flex items-center content-between gap-05 ${row.className ?? ''}`}
                                            role="group"
                                            aria-label={row.label}
                                        >
                                            <span className="canvas-form-label font-size-1">{row.label}</span>
                                            <Container className="canvas-form-control d-flex items-center gap-02">
                                                <CanvasSlider
                                                    ariaLabel={row.label}
                                                    min={row.min}
                                                    max={row.max}
                                                    step={row.step}
                                                    value={value}
                                                    onChange={onChange}
                                                    ariaValueText={String(row.format?.(value) ?? value)}
                                                />
                                                <span className="canvas-form-value font-size-1">
                                                    {row.format?.(value) ?? value}
                                                </span>
                                            </Container>
                                        </Container>
                                    );
                                })}
                                {section.extras}
                            </Container>
                        </Container>
                    );
                })}
            </Container>
        </>
    );
};

export default CanvasRenderSubsectionContent;
