import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { ISwitchStatementData } from '@/modules/plugin/api/entities/plugin/workflow';
import BaseNode from '@/modules/plugin/components/plugin/BaseNode';
import './SwitchStatementNode.css';

const SwitchStatementNode = (props: NodeProps) => {
    const { data } = props;
    const switchData = data.switchStatement as ISwitchStatementData | undefined;
    const description = switchData?.expression?.trim()
        ? `Expression: ${switchData.expression}`
        : 'No expression configured';

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.SWITCH_STATEMENT}
            description={description}
        />
    );
};

export default SwitchStatementNode;
