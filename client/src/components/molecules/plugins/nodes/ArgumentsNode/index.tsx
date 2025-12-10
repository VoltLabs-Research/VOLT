import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { NodeType } from '@/types/plugin';
import BaseNode from '@/components/atoms/plugins/BaseNode';
import NodeField from '@/components/atoms/plugins/NodeField';
import NodeBadge from '@/components/atoms/plugins/NodeBadge';

const ArgumentsNode = memo((props: NodeProps) => {
    const { data } = props;
    const args = data.arguments?.arguments || [];
    const presetCount = args.filter((a: any) => a.value !== undefined).length;
    const configurableCount = args.length - presetCount;

    return (
        <BaseNode {...props} nodeType={NodeType.ARGUMENTS}>
            <div className='workflow-node-field-container'>
                <h3 className='workflow-node-field-label'>Arguments</h3>
                <NodeBadge icon=''>{configurableCount} configurable</NodeBadge>
                {presetCount > 0 && (
                    <NodeBadge icon=''>{presetCount} presets</NodeBadge>
                )}
            </div>

            {args.length > 0 && (
                <div className='workflow-node-field-container'>
                    <div className='workflow-node-label'>Defined</div>
                    <div className='workflow-node-list-container'>
                        {args.slice(0, 3).map((arg: any, i: number) => (
                            <span key={i} className='workflow-node-tag'>
                                --{arg.argument}
                            </span>
                        ))}
                        {args.length > 3 && (
                            <span className='workflow-node-tag'>+{args.length - 3} more</span>
                        )}
                    </div>
                </div>
            )}
        </BaseNode>
    );
});

ArgumentsNode.displayName = 'ArgumentsNode';
export default ArgumentsNode;