import { memo } from 'react';
import useParticleFilter, { OPERATORS, ACTIONS, FilterOperator, FilterAction } from '@/modules/canvas/presentation/hooks/use-particle-filter';
import WidgetContainer from '@/modules/canvas/presentation/components/atoms/WidgetContainer';
import ModifierHeader from '@/modules/canvas/presentation/components/atoms/ModifierHeader';
import Button from '@/shared/presentation/components/Button';
import FormField from '@/shared/presentation/components/FormField';
import Container from '@/shared/presentation/components/Container';
import '@/modules/canvas/presentation/components/organisms/ParticleFilter/ParticleFilter.css';

interface ParticleFilterProps {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
}

const PreviewStats = memo(({ percentage }: { percentage: string }) => (
    <Container className='particle-filter-preview d-flex column gap-05 p-075 radius-md'>
        <Container className='preview-stats d-flex content-between font-size-1'>
            <span>Selection</span>
            <span className='stat-value'>{percentage}% of total</span>
        </Container>
    </Container>
));
PreviewStats.displayName = 'PreviewStats';

const ErrorMessage = memo(({ error }: { error: string }) => (
    <Container className='particle-filter-error p-05 radius-md font-size-1'>{error}</Container>
));
ErrorMessage.displayName = 'ErrorMessage';

interface PreviewResultViewProps {
    matchCount: number;
    percentage: string;
    action: FilterAction;
    setAction: (action: FilterAction) => void;
    error: string | null;
    isApplying: boolean;
    onApply: () => void;
    onCancel: () => void;
}

const PreviewResultView = memo(({
    matchCount,
    percentage,
    action,
    setAction,
    error,
    isApplying,
    onApply,
    onCancel
}: PreviewResultViewProps) => (
    <WidgetContainer className='particle-filter-action-panel p-1 overflow-hidden d-flex column gap-1 p-absolute right-1 bottom-1'>
        <ModifierHeader title={`${matchCount.toLocaleString()} Particles Selected`} modifierId='particle-filter' />

        <Container className='d-flex column gap-1'>
            <PreviewStats percentage={percentage} />

            <FormField
                fieldKey='action'
                fieldType='select'
                label='Action'
                fieldValue={action}
                onFieldChange={(_, value) => setAction(value as FilterAction)}
                options={ACTIONS}
            />

            {error && <ErrorMessage error={error} />}
        </Container>

        <Container className='d-flex column gap-05'>
            <Button
                isLoading={isApplying}
                variant='solid'
                intent={action === 'delete' ? 'danger' : 'brand'}
                block
                onClick={onApply}
                disabled={isApplying}
            >
                {action === 'delete' ? 'Delete Selection' : 'Apply Color'}
            </Button>
            <Button
                variant='ghost'
                block
                onClick={onCancel}
                disabled={isApplying}
            >
                Cancel
            </Button>
        </Container>
    </WidgetContainer>
));
PreviewResultView.displayName = 'PreviewResultView';

interface FilterFormViewProps {
    property: string;
    propertyOptions: { value: string; title: string }[];
    onPropertyChange: (value: string) => void;
    operator: FilterOperator;
    setOperator: (op: FilterOperator) => void;
    value: number;
    setValue: (val: number) => void;
    valueSuggestions: number[];
    onFetchSuggestions: () => void;
    error: string | null;
    isLoadingPreview: boolean;
    canPreview: boolean;
    onPreview: () => void;
}

const FilterFormView = memo(({
    property,
    propertyOptions,
    onPropertyChange,
    operator,
    setOperator,
    value,
    setValue,
    valueSuggestions,
    onFetchSuggestions,
    error,
    isLoadingPreview,
    canPreview,
    onPreview
}: FilterFormViewProps) => (
    <WidgetContainer className='particle-filter-container p-1 overflow-hidden d-flex column gap-1 p-absolute right-1 bottom-1'>
        <ModifierHeader title='Particle Filter' modifierId='particle-filter' />

        <Container className='d-flex column gap-1'>
            <FormField
                fieldKey='property'
                fieldType='select'
                label='Property'
                fieldValue={property}
                onFieldChange={(_, val) => onPropertyChange(String(val))}
                options={propertyOptions}
            />

            <FormField
                fieldKey='operator'
                fieldType='select'
                label='Operator'
                fieldValue={operator}
                onFieldChange={(_, val) => setOperator(val as FilterOperator)}
                options={OPERATORS}
            />

            <FormField
                fieldKey='value'
                fieldType='input'
                onFieldChange={(_, val) => setValue(Number(val))}
                fieldValue={value}
                label='Value'
                suggestions={valueSuggestions}
                onFetchSuggestions={onFetchSuggestions}
            />

            {error && <ErrorMessage error={error} />}
        </Container>

        <Button
            isLoading={isLoadingPreview}
            variant='solid'
            intent='brand'
            block
            onClick={onPreview}
            disabled={!canPreview}
        >
            Preview Selection
        </Button>
    </WidgetContainer>
));
FilterFormView.displayName = 'FilterFormView';

const ParticleFilter = memo(({ 
    trajectoryId,
    analysisId,
    currentTimestep 
}: ParticleFilterProps) => {
    const {
        property,
        propertyOptions,
        handlePropertyChange,
        operator,
        setOperator,
        value,
        setValue,
        action,
        setAction,
        valueSuggestions,
        fetchValueSuggestions,
        previewResult,
        isLoadingPreview,
        handlePreview,
        handleCancelPreview,
        percentage,
        canPreview,
        isApplying,
        handleApplyAction,
        error
    } = useParticleFilter({ trajectoryId, analysisId, currentTimestep });

    if (previewResult) {
        return (
            <PreviewResultView
                matchCount={previewResult.matchCount}
                percentage={percentage}
                action={action}
                setAction={setAction}
                error={error}
                isApplying={isApplying}
                onApply={handleApplyAction}
                onCancel={handleCancelPreview}
            />
        );
    }

    return (
        <FilterFormView
            property={property}
            propertyOptions={propertyOptions}
            onPropertyChange={handlePropertyChange}
            operator={operator}
            setOperator={setOperator}
            value={value}
            setValue={setValue}
            valueSuggestions={valueSuggestions}
            onFetchSuggestions={fetchValueSuggestions}
            error={error}
            isLoadingPreview={isLoadingPreview}
            canPreview={canPreview}
            onPreview={handlePreview}
        />
    );
});

ParticleFilter.displayName = 'ParticleFilter';

export default ParticleFilter;
