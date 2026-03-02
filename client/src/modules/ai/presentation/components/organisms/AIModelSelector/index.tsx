import type { SelectOption } from '@/shared/presentation/components/Select';
import Select from '@/shared/presentation/components/Select';
import Container from '@/shared/presentation/components/Container';
import { cn } from '@/shared/utils';

interface AIModelSelectorProps {
    modelOptions: SelectOption[];
    selectedModel: string | null;
    disabled?: boolean;
    className?: string;
    onModelChange: (model: string) => void;
}

const AIModelSelector = ({
    modelOptions,
    selectedModel,
    disabled = false,
    className = '',
    onModelChange
}: AIModelSelectorProps) => {
    return (
        <Container className={cn('d-flex column gap-025 ai-model-selector', className)}>
            <Select
                options={modelOptions}
                value={selectedModel}
                onChange={onModelChange}
                disabled={disabled || modelOptions.length === 0}
                placeholder={modelOptions.length ? 'Select model' : 'No models'}
                className='ai-model-selector-select'
            />
        </Container>
    );
};

export default AIModelSelector;
