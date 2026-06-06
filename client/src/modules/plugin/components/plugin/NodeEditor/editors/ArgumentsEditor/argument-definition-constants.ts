import { ArgumentVisibilityOperator } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { ARGUMENT_TYPE_OPTIONS } from '@/modules/plugin/utilities/plugin/node-registry';
import type { SelectOption } from '@/shared/presentation/primitives/Select';

export const ARGUMENT_TYPE_LABELS: Record<string, string> = ARGUMENT_TYPE_OPTIONS.reduce<Record<string, string>>(
    (accumulator, option) => {
        accumulator[option.value] = option.label;
        return accumulator;
    },
    {}
);

export const ARGUMENT_TYPE_SELECT_OPTIONS = ARGUMENT_TYPE_OPTIONS.map((option) => ({
    value: option.value,
    title: option.label
}));

export const ARGUMENT_VISIBILITY_OPERATOR_OPTIONS = [{
    value: ArgumentVisibilityOperator.EQUALS,
    title: 'Equals'
}, {
    value: ArgumentVisibilityOperator.NOT_EQUALS,
    title: 'Does not equal'
}, {
    value: ArgumentVisibilityOperator.IN,
    title: 'Matches any of'
}, {
    value: ArgumentVisibilityOperator.NOT_IN,
    title: 'Matches none of'
}];

export const BOOLEAN_ARGUMENT_VALUE_OPTIONS: SelectOption[] = [{
    value: '',
    title: 'Unset'
}, {
    value: 'true',
    title: 'true'
}, {
    value: 'false',
    title: 'false'
}];

export const ANY_PLUGIN_OPTION: SelectOption = {
    value: '',
    title: 'Any plugin'
};

export const ANY_PLUGIN_KEY_OPTION: SelectOption = {
    value: '',
    title: 'Any key'
};
