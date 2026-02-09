import type { ReactNode } from 'react';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import FormField from '@/shared/presentation/components/FormField';
import Loader from '@/shared/presentation/components/Loader';
import { Check } from 'lucide-react';
import type { IArgumentDefinition } from '@/modules/plugin/domain/entities';
import type { ModifierOption } from '../../../modifiers/registry';
import type { ExecState } from '../../../hooks/usePluginExecution';

interface ModifierConfigProps {
    children?: ReactNode;
    action?: ReactNode;
}

const ModifierConfig = ({ children, action }: ModifierConfigProps) => (
    <Container className="d-flex column gap-05">
        {children}
        {action}
    </Container>
);

interface PluginToggleProps {
    option: ModifierOption;
    execState: ExecState;
    onExecute: (option: ModifierOption) => void;
}

const TOGGLE_STATES: Record<string, { modifier?: string; content: React.ReactNode }> = {
    loading: { content: <Loader scale={0.4} isFixed={false} /> },
    success: { modifier: '--success', content: <><Check style={{ width: 13, height: 13 }} /><span>Analysis queued</span></> },
    error: { modifier: '--error', content: <span>Execution failed</span> }
};

const PluginToggle = ({ option, execState, onExecute }: PluginToggleProps) => {
    const state = TOGGLE_STATES[execState];
    if (state) {
        return (
            <Container className={`canvas-modifier-toggle-area${state.modifier ? ` canvas-modifier-toggle-area${state.modifier}` : ''} d-flex items-center content-center`}>
                {state.content}
            </Container>
        );
    }

    return (
        <Button variant="outline" intent="canvas" shape="square" size="sm" onClick={() => onExecute(option)}>
            Start
        </Button>
    );
};

interface LegacyToggleProps {
    option: ModifierOption;
    active: boolean;
    onToggle: (option: ModifierOption) => void;
}

const LegacyToggle = ({ option, active, onToggle }: LegacyToggleProps) => (
    <Button
        variant={active ? 'solid' : 'soft'}
        intent="canvas"
        shape="square"
        size="sm"
        onClick={() => onToggle(option)}
    >
        {active ? 'Stop' : 'Start'}
    </Button>
);

const getArgumentFieldProps = (arg: IArgumentDefinition, index: number) => {
    const label = arg.label;
    const fieldKey = `arg-${arg.argument}-${index}`;

    if(arg.type === 'boolean'){
        return { label, fieldKey, fieldType: 'checkbox' as const, fieldValue: true, variant: 'inline' as const };
    }

    if(arg.type === 'select'){
        return {
            label, fieldKey, fieldType: 'select' as const, fieldValue: '',
            options: arg.options.map((opt) => ({ value: opt.key, title: opt.label })),
            variant: 'inline' as const
        };
    }

    if(arg.type === 'frame'){
        return {
            label, fieldKey, fieldType: 'select' as const, fieldValue: 'Frame 1',
            options: [{ value: 'frame-1', title: 'Frame 1' }],
            variant: 'inline' as const
        };
    }

    return {
        label, fieldKey, fieldType: 'input' as const, fieldValue: '', variant: 'inline' as const,
        inputProps: arg.type === 'number' ? { type: 'number', step: arg.step, min: arg.min, max: arg.max } : undefined
    };
};

interface ArgumentFieldProps {
    arg: IArgumentDefinition;
    index: number;
}

const ArgumentField = ({ arg, index }: ArgumentFieldProps) => {
    const value = arg.value;
    const fieldProps = getArgumentFieldProps(arg, index);
    const fieldValue = fieldProps.fieldType === 'checkbox'
        ? Boolean(value)
        : fieldProps.fieldType === 'input'
            ? value !== undefined ? String(value) : ''
            : String(value);

    return (
        <FormField
            label={fieldProps.label}
            fieldType={fieldProps.fieldType}
            variant={fieldProps.variant}
            fieldKey={fieldProps.fieldKey}
            fieldValue={fieldValue}
            options={fieldProps.options}
            inputProps={fieldProps.inputProps}
            onFieldChange={() => {}}
        />
    );
};

export { PluginToggle, LegacyToggle, ArgumentField };
export default ModifierConfig;
