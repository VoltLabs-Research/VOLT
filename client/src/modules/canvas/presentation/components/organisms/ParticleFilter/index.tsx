import React from 'react';
import useParticleFilter, { OPERATORS, ACTIONS, type FilterOperator, type FilterAction } from '../../../hooks/use-particle-filter';
import Button from '@/shared/presentation/components/Button';
import FormField from '@/shared/presentation/components/FormField';
import Container from '@/shared/presentation/components/Container';
import './ParticleFilter.css';

interface ParticleFilterProps {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
}

const PreviewStats = ({ percentage }: { percentage: string }) => (
    <Container className="canvas-filter-preview d-flex column gap-05">
        <Container className="d-flex content-between">
            <span>Selection</span>
            <span className="color-primary">{percentage}% of total</span>
        </Container>
    </Container>
);

const ErrorMessage = ({ error }: { error: string }) => (
    <Container className="canvas-filter-error font-size-05">{error}</Container>
);

interface PreviewResultViewProps {
    percentage: string;
    action: FilterAction;
    setAction: (action: FilterAction) => void;
    error: string | null;
    isApplying: boolean;
    onApply: () => void;
    onCancel: () => void;
}

const PreviewResultView = ({
    percentage,
    action,
    setAction,
    error,
    isApplying,
    onApply,
    onCancel
}: PreviewResultViewProps) => (
    <Container className="canvas-filter-panel d-flex column gap-1">
        <Container className="d-flex column gap-1">
            <PreviewStats percentage={percentage} />

            <FormField
                fieldKey="action"
                fieldType="select"
                label="Action"
                fieldValue={action}
                onFieldChange={(_, value) => setAction(value as FilterAction)}
                options={ACTIONS}
            />

            {error && <ErrorMessage error={error} />}
        </Container>

        <Container className="d-flex column gap-05">
            <Button
                isLoading={isApplying}
                variant="solid"
                intent={action === 'delete' ? 'danger' : 'canvas'}
                block
                onClick={onApply}
                disabled={isApplying}
                shape="rounded"
                className="font-size-1"
            >
                {action === 'delete' ? 'Delete Selection' : 'Apply Color'}
            </Button>
            <Button
                variant="ghost"
                intent="canvas"
                shape="rounded"
                block
                onClick={onCancel}
                disabled={isApplying}
                className="font-size-1"
            >
                Cancel
            </Button>
        </Container>
    </Container>
);

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

const FilterFormView = ({
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
}: FilterFormViewProps) => {
    const selectFields: { key: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; title: string }[] }[] = [
        { key: 'property', label: 'Property', value: property, onChange: onPropertyChange, options: propertyOptions },
        { key: 'operator', label: 'Operator', value: operator, onChange: (v) => setOperator(v as FilterOperator), options: OPERATORS }
    ];

    return (
        <Container className="canvas-filter-panel d-flex column gap-1">
            <Container className="d-flex column gap-1">
                {selectFields.map((f) => (
                    <FormField
                        key={f.key}
                        fieldKey={f.key}
                        fieldType="select"
                        label={f.label}
                        fieldValue={f.value}
                        onFieldChange={(_, val) => f.onChange(String(val))}
                        options={f.options}
                    />
                ))}

                <FormField
                    fieldKey="value"
                    fieldType="input"
                    onFieldChange={(_, val) => setValue(Number(val))}
                    fieldValue={value}
                    label="Value"
                    suggestions={valueSuggestions}
                    onFetchSuggestions={onFetchSuggestions}
                />

                {error && <ErrorMessage error={error} />}
            </Container>

            <Container>
                <Button
                    isLoading={isLoadingPreview}
                    variant="soft"
                    intent="canvas"
                    shape="rounded"
                    block
                    onClick={onPreview}
                    disabled={!canPreview}
                    className="font-size-1"
                >
                    Preview
                </Button>
            </Container>
        </Container>
    );
};

const ParticleFilter = ({ trajectoryId, analysisId, currentTimestep }: ParticleFilterProps) => {
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
};

export default ParticleFilter;
