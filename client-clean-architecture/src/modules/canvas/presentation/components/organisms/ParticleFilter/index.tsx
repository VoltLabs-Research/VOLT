import { useState, useCallback } from 'react';
import usePropertySelector from '@/modules/trajectory/presentation/hooks/particle-filter/use-property-selector';
import EditorWidget from '@/modules/canvas/presentation/components/organisms/EditorWidget';
import Button from '@/shared/presentation/components/Button';
import FormField from '@/shared/presentation/components/FormField';
import Title from '@/shared/presentation/components/Title';
import Container from '@/shared/presentation/components/Container';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import useParticleFilterUseCases from '@/modules/trajectory/presentation/hooks/particle-filter/use-particle-filter-use-cases';
import '@/modules/canvas/presentation/components/organisms/ParticleFilter/ParticleFilter.css';

type FilterOperator = '==' | '!=' | '>' | '>=' | '<' | '<=';
type FilterAction = 'delete' | 'highlight';

const OPERATORS: { value: FilterOperator; title: string }[] = [
    { value: '==', title: '=' },
    { value: '!=', title: '!=' },
    { value: '>', title: '>' },
    { value: '>=', title: '>=' },
    { value: '<', title: '<' },
    { value: '<=', title: '<=' }
];

const ACTIONS: { value: FilterAction; title: string }[] = [
    { value: 'delete', title: 'Delete' },
    { value: 'highlight', title: 'Color Selection' }
];

const OPERATOR_MAP: Record<FilterOperator, 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'> = {
    '==': 'eq',
    '!=': 'ne',
    '>': 'gt',
    '>=': 'gte',
    '<': 'lt',
    '<=': 'lte'
};

const ParticleFilter = () => {
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const { searchParams } = useSearchParamsState();
    const analysisId = searchParams.get('analysis') || undefined;
    const { currentTimestep, setActiveScene } = useEditorStore(useShallow((state) => ({
        currentTimestep: state.currentTimestep,
        setActiveScene: state.setActiveScene
    })));

    const {
        property,
        exposureId,
        propertyOptions,
        isLoading,
        handlePropertyChange: baseHandlePropertyChange
    } = usePropertySelector({
        trajectoryId: trajectory?._id,
        analysisId,
        timestep: currentTimestep
    });

    const { particleFilterRepository } = useParticleFilterUseCases();

    const [operator, setOperator] = useState<FilterOperator>('==');
    const [value, setValue] = useState(0);
    const [action, setAction] = useState<FilterAction>('delete');
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [valueSuggestions, setValueSuggestions] = useState<number[]>([]);
    const [previewResult, setPreviewResult] = useState<{
        matchCount: number;
        totalCount: number;
        filterParams: {
            property: string;
            operator: FilterOperator;
            value: number;
            exposureId?: string;
        };
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handlePropertyChange = useCallback((value: string) => {
        baseHandlePropertyChange(value);
        setPreviewResult(null);
        setError(null);
        setValueSuggestions([]);
    }, [baseHandlePropertyChange]);

    const fetchValueSuggestions = useCallback(async () => {
        if (!property || !trajectory?._id || currentTimestep === undefined) return;

        try {
            const result = await particleFilterRepository.getUniqueValues({
                trajectoryId: trajectory._id,
                analysisId,
                timestep: currentTimestep,
                property,
                exposureId: exposureId || undefined,
                maxValues: 50
            });
            setValueSuggestions(result.values);
        } catch (err) {
            console.error('Failed to fetch suggestions:', err);
        }
    }, [trajectory, currentTimestep, property, analysisId, exposureId, particleFilterRepository]);

    const handlePreview = useCallback(async () => {
        if (!property || !trajectory?._id || currentTimestep === undefined) {
            setError('Missing required parameters');
            return;
        }

        const selectedOption = propertyOptions.find((opt) => opt.value === property);
        if (selectedOption?.exposureId && !analysisId) {
            setError('Analysis required for modifier properties');
            return;
        }

        setIsLoadingPreview(true);
        setError(null);
        setPreviewResult(null);

        try {
            const result = await particleFilterRepository.preview({
                trajectoryId: trajectory._id,
                analysisId,
                timestep: currentTimestep,
                conditions: [{
                    property,
                    operator: OPERATOR_MAP[operator],
                    value,
                    exposureId: exposureId || undefined
                }]
            });
            setPreviewResult({
                matchCount: result.matchCount,
                totalCount: result.totalCount,
                filterParams: { property, operator, value, exposureId: exposureId || undefined }
            });
        } catch (err: any) {
            setError(err.message || 'Preview failed');
        } finally {
            setIsLoadingPreview(false);
        }
    }, [trajectory, analysisId, currentTimestep, property, operator, value, exposureId, propertyOptions, particleFilterRepository]);

    const handleApplyAction = useCallback(async () => {
        if (!previewResult || !trajectory?._id || currentTimestep === undefined) {
            setError('Run preview first');
            return;
        }

        setIsApplying(true);
        setError(null);

        try {
            const { filterParams } = previewResult;
            await particleFilterRepository.applyAction({
                trajectoryId: trajectory._id,
                analysisId,
                timestep: currentTimestep,
                conditions: [{
                    property: filterParams.property,
                    operator: OPERATOR_MAP[filterParams.operator],
                    value: filterParams.value,
                    exposureId: filterParams.exposureId
                }],
                action
            });

            setActiveScene({
                sceneType: 'particle-filter',
                source: 'particle-filter',
                analysisId,
                property: filterParams.property,
                operator: filterParams.operator,
                value: filterParams.value,
                action,
                exposureId: filterParams.exposureId
            } as any);

            setPreviewResult(null);
        } catch (err: any) {
            setError(err.message || 'Action failed');
        } finally {
            setIsApplying(false);
        }
    }, [trajectory, analysisId, currentTimestep, action, previewResult, setActiveScene, particleFilterRepository]);

    const handleCancelPreview = () => {
        setPreviewResult(null);
        setError(null);
    };

    const getPercentage = (): string => {
        if (!previewResult) return '0';
        const pct = (previewResult.matchCount / previewResult.totalCount) * 100;
        return pct.toFixed(2);
    };

    if (previewResult) {
        return (
            <EditorWidget className='particle-filter-action-panel p-1 overflow-hidden d-flex column gap-1' draggable={false}>
                <Container className='d-flex content-between items-center'>
                    <Title className='font-weight-5-5'>{previewResult.matchCount.toLocaleString()} Particles Selected</Title>
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
                        onFieldChange={(_, value) => setAction(value as FilterAction)}
                        options={ACTIONS}
                    />

                    {error && (
                        <Container className='particle-filter-error'>
                            {error}
                        </Container>
                    )}
                </Container>

                <Container className='d-flex column gap-05'>
                    <Button
                        isLoading={isApplying}
                        variant='solid'
                        intent={action === 'delete' ? 'danger' : 'brand'}
                        block
                        onClick={handleApplyAction}
                        disabled={isApplying}
                    >
                        {action === 'delete' ? 'Delete Selection' : 'Apply Color'}
                    </Button>
                    <Button
                        variant='ghost'
                        block
                        onClick={handleCancelPreview}
                        disabled={isApplying}
                    >
                        Cancel
                    </Button>
                </Container>
            </EditorWidget>
        );
    }

    return (
        <EditorWidget className='particle-filter-container p-1 overflow-hidden d-flex column gap-1' draggable={false}>
            <Container className='d-flex content-between items-center'>
                <Title className='font-weight-5-5'>Particle Filter</Title>
            </Container>

            <Container className='d-flex column gap-1'>
                <FormField
                    fieldKey='property'
                    fieldType='select'
                    label='Property'
                    fieldValue={property}
                    onFieldChange={(_, value) => handlePropertyChange(String(value))}
                    options={propertyOptions}
                />

                <FormField
                    fieldKey='operator'
                    fieldType='select'
                    label='Operator'
                    fieldValue={operator}
                    onFieldChange={(_, value) => setOperator(value as FilterOperator)}
                    options={OPERATORS}
                />

                <FormField
                    fieldKey='value'
                    fieldType='input'
                    onFieldChange={(_, value) => setValue(Number(value))}
                    fieldValue={value}
                    label='Value'
                    suggestions={valueSuggestions}
                    onFetchSuggestions={fetchValueSuggestions}
                />

                {error && (
                    <Container className='particle-filter-error'>
                        {error}
                    </Container>
                )}
            </Container>

            <Button
                isLoading={isLoadingPreview}
                variant='solid'
                intent='brand'
                block
                onClick={handlePreview}
                disabled={isLoadingPreview || isApplying || !property || isLoading}
            >
                Preview Selection
            </Button>
        </EditorWidget>
    );
};

export default ParticleFilter;
