import { ACTIONS, OPERATORS } from '../../../hooks/use-particle-filter';
import useParticleFilter from '../../../hooks/use-particle-filter';

import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';

import type { FilterAction, FilterOperator } from '../../../hooks/use-particle-filter';

import './ParticleFilter.css';

interface SelectOption {
    value: string;
    title: string;
};

interface PreviewStatsProps {
    percentage: string;
};

interface ErrorMessageProps {
    error: string;
};

interface SelectFieldConfig {
    key: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
};

interface ParticleFilterProps {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
};

interface PreviewResultViewProps {
    percentage: string;
    action: FilterAction;
    setAction: (action: FilterAction) => void;
    error: string | null;
    isApplying: boolean;
    onApply: () => void;
    onCancel: () => void;
};

interface FilterFormViewProps {
    propertyValue: string;
    propertyOptions: SelectOption[];
    onPropertyChange: (value: string) => void;
    operator: FilterOperator;
    setOperator: (operator: FilterOperator) => void;
    valueInput: string;
    setValue: (value: string) => void;
    valueSuggestions: number[];
    onFetchSuggestions: () => void;
    isLoadingSuggestions: boolean;
    error: string | null;
    isLoadingPreview: boolean;
    canPreview: boolean;
    onPreview: () => void;
};

const PreviewStats = ({ percentage }: PreviewStatsProps) => (
    <Container className="canvas-filter-preview radius-sm d-flex column gap-05">
        <Container className="d-flex content-between">
            <span>Selection</span>
            <span className="color-primary">{percentage}% of total</span>
        </Container>
    </Container>
);

const ErrorMessage = ({ error }: ErrorMessageProps) => (
    <Container className="canvas-filter-error font-size-05">{error}</Container>
);

const PreviewResultView = ({
    percentage,
    action,
    setAction,
    error,
    isApplying,
    onApply,
    onCancel
}: PreviewResultViewProps) => (
    <Container className="canvas-filter-panel d-flex column gap-05">
        <Container className="d-flex column gap-05">
            <PreviewStats percentage={percentage} />

            <FormFieldRHF
                fieldKey="action"
                fieldType="select"
                label="Action"
                fieldValue={action}
                onFieldChange={(_, value) => setAction(String(value) as FilterAction)}
                options={ACTIONS}
                variant="canvas"
            />

            {error && <ErrorMessage error={error} />}
        </Container>

        <Container className="d-flex column gap-025">
            <Button
                isLoading={isApplying}
                variant="solid"
                intent={action === 'delete' ? 'danger' : 'canvas'}
                block
                onClick={onApply}
                disabled={isApplying}
                shape="rounded"
                size="sm"
                className="font-size-05"
            >
                {action === 'delete' ? 'Delete Selection' : 'Apply Color'}
            </Button>
            <Button
                variant="ghost"
                intent="canvas"
                shape="rounded"
                size="sm"
                block
                onClick={onCancel}
                disabled={isApplying}
                className="font-size-05"
            >
                Cancel
            </Button>
        </Container>
    </Container>
);

const FilterFormView = ({
    propertyValue,
    propertyOptions,
    onPropertyChange,
    operator,
    setOperator,
    valueInput,
    setValue,
    valueSuggestions,
    onFetchSuggestions,
    isLoadingSuggestions,
    error,
    isLoadingPreview,
    canPreview,
    onPreview
}: FilterFormViewProps) => {
    const handleOperatorChange = (value: string) => {
        setOperator(value as FilterOperator);
    };

    const selectFields: SelectFieldConfig[] = [
        {
            key: 'property',
            label: 'Property',
            value: propertyValue,
            onChange: onPropertyChange,
            options: propertyOptions
        },
        {
            key: 'operator',
            label: 'Operator',
            value: operator,
            onChange: handleOperatorChange,
            options: OPERATORS
        }
    ];

    return (
        <Container className="canvas-filter-panel d-flex column gap-05">
            <Container className="d-flex column gap-05">
                {selectFields.map((field) => (
                    <FormFieldRHF
                        key={field.key}
                        fieldKey={field.key}
                        fieldType="select"
                        label={field.label}
                        fieldValue={field.value}
                        onFieldChange={(_, value) => field.onChange(String(value))}
                        options={field.options}
                        variant="canvas"
                    />
                ))}

                <FormFieldRHF
                    fieldKey="value"
                    fieldType="input"
                    onFieldChange={(_, nextValue) => setValue(String(nextValue))}
                    fieldValue={valueInput}
                    label="Value"
                    suggestions={valueSuggestions}
                    onFetchSuggestions={onFetchSuggestions}
                    isLoading={isLoadingSuggestions}
                    inputProps={{ inputMode: 'decimal' }}
                    variant="canvas"
                />

                {error && <ErrorMessage error={error} />}
            </Container>

            <Container>
                <Button
                    isLoading={isLoadingPreview}
                    variant="soft"
                    intent="canvas"
                    shape="rounded"
                    size="sm"
                    block
                    onClick={onPreview}
                    disabled={!canPreview}
                    className="font-size-05"
                >
                    Preview
                </Button>
            </Container>
        </Container>
    );
};

const ParticleFilter = ({ trajectoryId, analysisId, currentTimestep }: ParticleFilterProps) => {
    const {
        propertyValue,
        propertyOptions,
        handlePropertyChange,
        operator,
        setOperator,
        valueInput,
        setValue,
        action,
        setAction,
        valueSuggestions,
        fetchValueSuggestions,
        isLoadingValueSuggestions,
        previewResult,
        isLoadingPreview,
        handlePreview,
        handleCancelPreview,
        percentage,
        canPreview,
        isApplying,
        handleApplyAction,
        error
    } = useParticleFilter({
        trajectoryId,
        analysisId,
        currentTimestep
    });

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
            propertyValue={propertyValue}
            propertyOptions={propertyOptions}
            onPropertyChange={handlePropertyChange}
            operator={operator}
            setOperator={setOperator}
            valueInput={valueInput}
            setValue={setValue}
            valueSuggestions={valueSuggestions}
            onFetchSuggestions={fetchValueSuggestions}
            isLoadingSuggestions={isLoadingValueSuggestions}
            error={error}
            isLoadingPreview={isLoadingPreview}
            canPreview={canPreview}
            onPreview={handlePreview}
        />
    );
};

export default ParticleFilter;
