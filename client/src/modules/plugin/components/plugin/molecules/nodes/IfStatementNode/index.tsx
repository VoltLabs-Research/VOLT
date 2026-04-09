import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { IIfStatementData } from '@/modules/plugin/api/entities/plugin/workflow';
import BaseNode from '@/modules/plugin/components/plugin/atoms/BaseNode';
import './IfStatementNode.css';

const IfStatementNode = (props: NodeProps) => {
    const { data } = props;
    const ifData = data.ifStatement as IIfStatementData | undefined;
    const conditionCount = ifData?.conditions?.length || 0;

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.IF_STATEMENT}
            description={conditionCount > 0 ? `${conditionCount} condition(s)` : 'No conditions'}
        />
    );
};

export default IfStatementNode;
