import React, { useMemo, useState } from 'react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import Container from '@/shared/presentation/components/Container';
import FormField from '@/shared/presentation/components/FormField';
import Slider from '@/shared/presentation/components/Slider';
import useLightsGroup from './groups/lights';
import useEffectsGroup from './groups/effects';
import usePerformanceGroup from './groups/performance';
import useEnvironmentGroup from './groups/environment';
import useCameraGroup from './groups/camera';
import useOrbitGroup from './groups/orbit';
import useRendererGroup from './groups/renderer';
import useGridGroup from './groups/grid';
import type { RenderGroup } from './types';
import './CanvasRenderSections.css';

const CanvasRenderSections = () => {
    const [openGroupId, setOpenGroupId] = useState<string | null>(null);
    const [openSubsectionByGroup, setOpenSubsectionByGroup] = useState<Record<string, number[]>>({});

    const lightsGroup = useLightsGroup();
    const effectsGroup = useEffectsGroup();
    const performanceGroup = usePerformanceGroup();
    const environmentGroup = useEnvironmentGroup();
    const cameraGroup = useCameraGroup();
    const orbitGroup = useOrbitGroup();
    const rendererGroup = useRendererGroup();
    const gridGroup = useGridGroup();

    const groups = useMemo<RenderGroup[]>(
        () => [
            lightsGroup,
            effectsGroup,
            performanceGroup,
            environmentGroup,
            cameraGroup,
            orbitGroup,
            rendererGroup,
            gridGroup
        ],
        [
            lightsGroup,
            effectsGroup,
            performanceGroup,
            environmentGroup,
            cameraGroup,
            orbitGroup,
            rendererGroup,
            gridGroup
        ]
    );

    return (
        <>
            {groups.map((group) => {
                const isOpen = openGroupId === group.id;

                const visibleSubsections = group.subsections.filter((sub) => sub.visible !== false);
                const hasSubsections = visibleSubsections.length > 1;
                const openIndices = openSubsectionByGroup[group.id];

                return (
                    <CollapsibleSection
                        key={group.id}
                        title={group.title}
                        icon={group.icon}
                        expanded={isOpen}
                        onExpandedChange={() => setOpenGroupId((prev) => prev === group.id ? null : group.id)}
                        className="canvas-section"
                        headerClassName="d-flex items-center gap-05 p-05"
                        titleClassName="font-size-1 color-secondary"
                        iconClassName="canvas-section-icon color-muted"
                        bodyClassName="p-0"
                        contentClassName="canvas-render-section-body d-flex column"
                        noSpacing
                        arrowSize={13}
                        useDefaultHeaderStyles={false}
                        useDefaultTitleStyles={false}
                    >
                        {visibleSubsections.map((sub, idx) => {
                            const isSubOpen = hasSubsections ? openIndices.includes(idx) : true;

                            return (
                                <CollapsibleSection
                                    key={`${group.id}-${idx}`}
                                    title={sub.label}
                                    icon={sub.icon}
                                    expanded={isSubOpen}
                                    onExpandedChange={hasSubsections
                                        ? () =>
                                            setOpenSubsectionByGroup((prev) => {
                                                const current = prev[group.id];
                                                const exists = current.includes(idx);
                                                const next = exists
                                                    ? current.filter((value) => value !== idx)
                                                    : [...current, idx];
                                                return {
                                                    ...prev,
                                                    [group.id]: next
                                                };
                                            })
                                        : undefined
                                    }
                                    headerClassName="d-flex items-center gap-05"
                                    titleClassName="font-size-1 color-secondary"
                                    iconClassName="canvas-section-icon color-muted"
                                    contentClassName="d-flex column"
                                    noSpacing
                                    arrowSize={13}
                                    useDefaultHeaderStyles={false}
                                    useDefaultTitleStyles={false}
                                >
                                    <Container>
                                        {sub.sections.map((section) => (
                                            <Container key={section.key} className="canvas-form-section d-flex column gap-05">
                                                {section.onToggle && (
                                                    <Container className="canvas-form-section-header d-flex items-center content-between">
                                                        <span className="canvas-form-section-title font-weight-5">Enabled</span>
                                                        <FormField
                                                            fieldValue={section.enabled}
                                                            fieldKey={`${section.key}-enabled`}
                                                            fieldType="checkbox"
                                                            onFieldChange={(_, next) => section.onToggle?.(Boolean(next))}
                                                            variant="inline"
                                                        />
                                                    </Container>
                                                )}
                                                <Container className="d-flex column gap-05">
                                                    {section.rows.map((row) => {
                                                        const value = 'get' in row ? row.get() : row.value;
                                                        const onChange = 'set' in row ? row.set : row.onChange;
                                                        return (
                                                            <Container
                                                                key={`${section.key}-${row.label}`}
                                                                className={`canvas-form-row d-flex items-center content-between gap-05 ${row.className}`}
                                                            >
                                                                <label className="canvas-form-label">{row.label}</label>
                                                                <Container className="canvas-form-control d-flex items-center gap-02">
                                                                    <Slider
                                                                        min={row.min}
                                                                        max={row.max}
                                                                        step={row.step}
                                                                        value={value}
                                                                        onChange={onChange}
                                                                    />
                                                                    <span className="canvas-form-value">
                                                                        {row.format(value)}
                                                                    </span>
                                                                </Container>
                                                            </Container>
                                                        );
                                                    })}
                                                    {section.extras}
                                                </Container>
                                            </Container>
                                        ))}
                                    </Container>
                                </CollapsibleSection>
                            );
                        })}
                    </CollapsibleSection>
                );
            })}
        </>
    );
};

export default CanvasRenderSections;
