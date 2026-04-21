import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { NodeProps } from '@xyflow/react';
import type { ISwitchCaseData } from '@/modules/plugin/api/entities/plugin/workflow';
import BaseNode from '@/modules/plugin/components/plugin/BaseNode';

const SwitchCaseNode = (props: NodeProps) => {
    const { data } = props;
    const switchCase = (data.switchCase as ISwitchCaseData) || {};
    const description = switchCase.defaultCase
        ? 'Default case'
        : switchCase.value?.trim()
            ? `Value: ${switchCase.value}`
            : 'No case value configured';

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.SWITCH_CASE}
            description={description}
        />
    );
};

export default SwitchCaseNode;
