/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 */

import { useState, useCallback } from 'react';
import { useParticleFilterPreview, useParticleFilterApply } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';
import usePropertySelector from '@/modules/trajectory/presentation/hooks/use-property-selector';
import EditorWidget from '@/modules/canvas/presentation/components/organisms/EditorWidget';
import Button from '@/shared/presentation/components/primitives/Button';
import FormField from '@/shared/presentation/components/molecules/form/FormField';
import Title from '@/shared/presentation/components/primitives/Title';
import Container from '@/shared/presentation/components/primitives/Container';
import '@/modules/canvas/presentation/components/organisms/ParticleFilter/ParticleFilter.css';

type FilterOperator = '==' | '!=' | '>' | '>=' | '<' | '<=';
type FilterAction = 'delete' | 'highlight';

interface PreviewResult {
    matchCount: number;
    totalCount: number;
}

const OPERATORS: { value: FilterOperator; title: string }[] = [
    { value: '==', title: '=' },
    { value: '!=', title: '≠' },
    { value: '>', title: '>' },
    { value: '>=', title: '≥' },
    { value: '<', title: '<' },
    { value: '<=', title: '≤' }
];

const ACTIONS: { value: FilterAction; title: string }[] = [
    { value: 'delete', title: 'Delete' },
    { value: 'highlight', title: 'Color Selection' }
];

const ParticleFilter = () => {
    const {
        property,
        exposureId,
        propertyOptions,
        isLoading,
        handlePropertyChange: baseHandlePropertyChange,
        trajectory,
        analysisConfig,
        currentTimestep,
        setActiveScene
    } = usePropertySelector();

    const [operator, setOperator] = useState<FilterOperator>('==');
    const [value, setValue] = useState(0);
    const [action, setAction] = useState<FilterAction>('delete');
    
    const previewMutation = useParticleFilterPreview();
    const applyMutation = useParticleFilterApply();

    const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handlePropertyChange = useCallback((value: string) => {
        baseHandlePropertyChange(value);
        setPreviewResult(null);
        setError(null);
    }, [baseHandlePropertyChange]);

    const handlePreview = useCallback(async () => {
        if (!property || !trajectory?._id || currentTimestep === undefined) {
            setError('Missing required parameters');
            return;
        }

        // For modifier properties, we need analysisId
        const selectedOption = propertyOptions.find(opt => opt.value === property);
        if (selectedOption?.exposureId && !analysisConfig?._id) {
            setError('Analysis required for modifier properties');
            return;
        }

        setError(null);
        setPreviewResult(null);

        try {
            const result = await previewMutation.mutateAsync({
                trajectoryId: trajectory._id,
                analysisId: analysisConfig?._id,
                timestep: currentTimestep,
                property,
                operator,
                value,
                exposureId: exposureId || undefined
            });
            setPreviewResult({ matchCount: result.matchCount, totalCount: result.totalAtoms });
        } catch (err: any) {
            setError(err.message || 'Preview failed');
        }
    }, [trajectory, analysisConfig, currentTimestep, property, operator, value, exposureId, previewMutation, propertyOptions]);

    const handleApplyAction = useCallback(async () => {
        if (!previewResult || !trajectory?._id || currentTimestep === undefined) {
            setError('Run preview first');
            return;
        }

        setError(null);

        try {
            const result = await applyMutation.mutateAsync({
                trajectoryId: trajectory._id,
                analysisId: analysisConfig?._id,
                timestep: currentTimestep,
                property,
                operator,
                value,
                action,
                exposureId: exposureId || undefined
            });

            setActiveScene({
                analysisId: analysisConfig?._id,
                source: 'particle-filter',
                fileId: result.fileId,
                atomsResult: result.atomsResult,
                property,
                operator,
                value,
                action,
                exposureId: exposureId || undefined
            } as any);

            setPreviewResult(null);
        } catch (err: any) {
            setError(err.message || 'Action failed');
        }
    }, [trajectory, analysisConfig, currentTimestep, property, operator, value, action, exposureId, previewResult, setActiveScene, applyMutation]);

    const handleCancelPreview = () => {
        setPreviewResult(null);
        setError(null);
    };

    const formatNumber = (num: number): string => {
        return num.toLocaleString('en-US');
    };

    const getPercentage = (): string => {
        if (!previewResult) return '0';
        const pct = (previewResult.matchCount / previewResult.totalCount) * 100;
        return pct.toFixed(2);
    };

    // Show action panel when preview result exists
    if (previewResult) {
        return (
            <EditorWidget className='particle-filter-action-panel overflow-hidden d-flex column gap-1' draggable={false}>
                <Container className='d-flex content-between items-center'>
                    <Title className='font-weight-5-5'>{formatNumber(previewResult.matchCount)} Particles Selected</Title>
                </Container>

                <Container className='d-flex column gap-1'>
                    <Container className='particle-filter-preview d-flex column gap-05'>
                        <Container className='preview-stats d-flex content-between'>
                            <span>Selection</span>
                            <span className='stat-value'>{getPercentage()}% of total</span>
                        </Container>
                    </Container>

                    <FormField
                        fieldKey='action'
                        fieldType='select'
                        label='Action'
                        fieldValue={action}
                        onFieldChange={(_, v) => setAction(v)}
                        options={ACTIONS}
                    />

                    {(error || applyMutation.error) && (
                        <Container className='particle-filter-error'>
                            {error || (applyMutation.error as any)?.message}
                        </Container>
                    )}
                </Container>

                <Container className='d-flex column gap-05'>
                    <Button
                        isLoading={applyMutation.isPending}
                        variant='solid'
                        intent={action === 'delete' ? 'danger' : 'brand'}
                        block
                        onClick={handleApplyAction}
                        disabled={applyMutation.isPending}
                    >
                        {action === 'delete' ? 'Delete Selection' : 'Apply Color'}
                    </Button>
                    <Button
                        variant='ghost'
                        block
                        onClick={handleCancelPreview}
                        disabled={applyMutation.isPending}
                    >
                        Cancel
                    </Button>
                </Container>
            </EditorWidget>
        );
    }

    // Main Filter Panel
    return (
        <EditorWidget className='particle-filter-container overflow-hidden d-flex column gap-1' draggable={false}>
            <Container className='d-flex content-between items-center'>
                <Title className='font-weight-5-5'>Particle Filter</Title>
            </Container>

            <Container className='d-flex column gap-1'>
                <FormField
                    fieldKey='property'
                    fieldType='select'
                    label='Property'
                    fieldValue={property}
                    onFieldChange={(_, v) => handlePropertyChange(v)}
                    options={propertyOptions}
                />

                <FormField
                    fieldKey='operator'
                    fieldType='select'
                    label='Operator'
                    fieldValue={operator}
                    onFieldChange={(_, v) => setOperator(v)}
                    options={OPERATORS}
                />

                <FormField
                    fieldKey='value'
                    fieldType='input'
                    onFieldChange={(_, v) => setValue(v)}
                    fieldValue={value}
                    label='Value'
                />

                {(error || previewMutation.error) && (
                    <Container className='particle-filter-error'>
                        {error || (previewMutation.error as any)?.message}
                    </Container>
                )}
            </Container>

            <Button
                isLoading={previewMutation.isPending}
                variant='solid'
                intent='brand'
                block
                onClick={handlePreview}
                disabled={previewMutation.isPending || applyMutation.isPending || !property || isLoading}
            >
                Preview Selection
            </Button>
        </EditorWidget>
    );
};

export default ParticleFilter;
