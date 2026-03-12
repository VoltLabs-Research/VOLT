import useCameraGroup from './groups/camera';
import useEffectsGroup from './groups/effects';
import useEnvironmentGroup from './groups/environment';
import useGridGroup from './groups/grid';
import useLightsGroup from './groups/lights';
import useOrbitGroup from './groups/orbit';
import usePerformanceGroup from './groups/performance';
import usePointCloudGroup from './groups/point-clouds';
import useRendererGroup from './groups/renderer';

import { memo, useMemo, useState } from 'react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Slider from '@/shared/presentation/components/Slider';

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
    const pointCloudGroup = usePointCloudGroup();
    const gridGroup = useGridGroup();

    const groups = useMemo<RenderGroup[]>(
        () => [lightsGroup, effectsGroup, performanceGroup, rendererGroup, pointCloudGroup, environmentGroup, cameraGroup, orbitGroup, gridGroup],
        [lightsGroup, effectsGroup, performanceGroup, rendererGroup, pointCloudGroup, environmentGroup, cameraGroup, orbitGroup, gridGroup]
    );

    return (
        <>
            {groups.map((group) => {
                const isOpen = openGroupId === group.id;
                const visibleSubsections = group.subsections.filter((sub) => sub.visible !== false);
                const hasSubsections = visibleSubsections.length > 1;
                const openIndices = openSubsectionByGroup[group.id] ?? [];

                return (
                    <CollapsibleSection
                        key={group.id}
                        title={group.title}
                        icon={group.icon}
                        expanded={isOpen}
                        onExpandedChange={() => setOpenGroupId((prev) => prev === group.id ? null : group.id)}
                        className="canvas-right-dropdown"
                        headerClassName="canvas-right-dropdown-header d-flex items-center gap-05"
                        titleClassName="canvas-right-dropdown-title font-size-05 color-muted"
                        iconClassName="canvas-right-dropdown-icon"
                        bodyClassName="canvas-right-dropdown-body"
                        contentClassName="d-flex column"
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
                                                const current = prev[group.id] ?? [];
                                                const exists = current.includes(idx);
                                                const next = exists
                                                    ? current.filter((value) => value !== idx)
                                                    : [...current, idx];
                                                return { ...prev, [group.id]: next };
                                            })
                                        : undefined
                                    }
                                    className="canvas-right-dropdown"
                                    headerClassName="canvas-right-dropdown-header d-flex items-center gap-05"
                                    titleClassName="canvas-right-dropdown-title font-size-05 color-muted"
                                    iconClassName="canvas-right-dropdown-icon"
                                    bodyClassName="canvas-right-dropdown-body"
                                    contentClassName="d-flex column canvas-render-subsection-body"
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
                                                <Container className="d-flex column gap-05">
                                                    {section.rows.map((r) => {
                                                        const value = 'get' in r ? r.get() : r.value;
                                                        const onChange = 'set' in r ? r.set : r.onChange;
                                                        return (
                                                            <Container
                                                                key={`${section.key}-${r.label}`}
                                                                className={`canvas-form-row d-flex items-center content-between gap-05 ${r.className ?? ''}`}
                                                            >
                                                                <label className="canvas-form-label font-size-05">{r.label}</label>
                                                                <Container className="canvas-form-control d-flex items-center gap-02">
                                                                    <Slider
                                                                        min={r.min}
                                                                        max={r.max}
                                                                        step={r.step}
                                                                        value={value}
                                                                        onChange={onChange}
                                                                    />
                                                                    <span className="canvas-form-value font-size-05">
                                                                        {r.format?.(value) ?? value}
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

export default memo(CanvasRenderSections);
