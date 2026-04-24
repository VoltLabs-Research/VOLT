import CanvasSlider from '../CanvasSlider';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Box from '@/shared/presentation/primitives/Box';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
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
                <Box className="canvas-render-disabled-reason font-size-05">
                    {subDisabledReason}
                </Box>
            )}
            <Box className={contentClassName || undefined}>
                {subsection.sections.map((section) => {
                    const isSectionDisabled = isSubDisabled || section.disabled === true;
                    const sectionDisabledReason = !isSubDisabled ? section.disabledReason : undefined;

                    return (
                        <Stack key={section.key} gap='05' className={`canvas-form-section${isSectionDisabled ? ' canvas-render-disabled' : ''}`}>
                            {sectionDisabledReason && (
                                <Box className="canvas-render-disabled-reason font-size-05">
                                    {sectionDisabledReason}
                                </Box>
                            )}
                            {section.onToggle && (
                                <Row justify='between' className="canvas-form-section-header" role="group" aria-label={`${section.key} toggle`}>
                                    <Text size='sm' weight='medium' className="canvas-form-section-title">Enabled</Text>
                                    <FormFieldRHF
                                        fieldValue={section.enabled}
                                        fieldKey={`${section.key}-enabled`}
                                        fieldType="checkbox"
                                        onFieldChange={(_, next) => section.onToggle?.(Boolean(next))}
                                        variant="inline"
                                    />
                                </Row>
                            )}
                            <Stack gap='05' className={isSectionDisabled ? 'canvas-render-disabled-content' : undefined}>
                                {section.rows.map((row) => {
                                    const value = 'get' in row ? row.get() : row.value;
                                    const onChange = 'set' in row ? row.set : row.onChange;

                                    return (
                                        <Row key={`${section.key}-${row.label}`} justify='between' gap='05' className={`canvas-form-row ${row.className ?? ''}`} role="group" aria-label={row.label}>
                                            <Text size='sm' className="canvas-form-label">{row.label}</Text>
                                            <Row gap='02' className="canvas-form-control">
                                                <CanvasSlider
                                                    ariaLabel={row.label}
                                                    min={row.min}
                                                    max={row.max}
                                                    step={row.step}
                                                    value={value}
                                                    onChange={onChange}
                                                    ariaValueText={String(row.format?.(value) ?? value)}
                                                />
                                                <Text size='sm' className="canvas-form-value">
                                                    {row.format?.(value) ?? value}
                                                </Text>
                                            </Row>
                                        </Row>
                                    );
                                })}
                                {section.extras}
                            </Stack>
                        </Stack>
                    );
                })}
            </Box>
        </>
    );
};

export default CanvasRenderSubsectionContent;
