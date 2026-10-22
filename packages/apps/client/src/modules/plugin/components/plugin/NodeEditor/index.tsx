import { Alert, Button, Tabs } from '@heroui/react';
import { useState } from 'react';
import type { Key } from 'react';
import type { FC } from 'react';
import { Trash2 } from 'lucide-react';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import { NODE_CONFIGS } from '@/modules/plugin/utils/plugin/node-registry';
import type { EditorProps } from '@/modules/plugin/contracts/node-editors';
import ModifierEditor from './editors/ModifierEditor';
import ArgumentsEditor from './editors/ArgumentsEditor';
import ContextEditor from './editors/ContextEditor';
import ForEachEditor from './editors/ForEachEditor';
import EntrypointEditor from './editors/EntrypointEditor';
import PluginNodeEditor from './editors/PluginNodeEditor';
import ExposureEditor from './editors/ExposureEditor';
import ExportEditor from './editors/ExportEditor';
import IfStatementEditor from './editors/IfStatementEditor';
import SwitchStatementEditor from './editors/SwitchStatementEditor';
import SwitchCaseEditor from './editors/SwitchCaseEditor';
import ConnectorLayoutEditor from './ConnectorLayoutEditor';
import Scrollable from '@/shared/ui/components/Scrollable';

type NodeEditorSection = 'details' | 'connectors';

const EDITOR_COMPONENTS: Partial<Record<NodeType, FC<EditorProps>>> = {
    [NodeType.MODIFIER]: ModifierEditor,
    [NodeType.ARGUMENTS]: ArgumentsEditor,
    [NodeType.CONTEXT]: ContextEditor,
    [NodeType.FOREACH]: ForEachEditor,
    [NodeType.ENTRYPOINT]: EntrypointEditor,
    [NodeType.PLUGIN]: PluginNodeEditor,
    [NodeType.EXPOSURE]: ExposureEditor,
    [NodeType.EXPORT]: ExportEditor,
    [NodeType.IF_STATEMENT]: IfStatementEditor,
    [NodeType.SWITCH_STATEMENT]: SwitchStatementEditor,
    [NodeType.SWITCH_CASE]: SwitchCaseEditor
};

const SECTION_TABS: ReadonlyArray<{ id: NodeEditorSection; label: string }> = [
    {
        id: 'details',
        label: 'Details'
    },
    {
        id: 'connectors',
        label: 'Connectors'
    }
];

const NodeEditor = ({ node }: EditorProps) => {
    const deleteNode = usePluginBuilderStore((state) => state.deleteNode);
    const selectNode = usePluginBuilderStore((state) => state.selectNode);
    const [activeSection, setActiveSection] = useState<NodeEditorSection>('details');

    const nodeType = node.type as NodeType;
    const EditorComponent = EDITOR_COMPONENTS[nodeType];
    const nodeDescription = NODE_CONFIGS[nodeType]?.description;

    const handleDelete = () => {
        deleteNode(node.id);
        selectNode(null);
    };

    return (
        <>
            <Tabs
                selectedKey={activeSection}
                onSelectionChange={(key: Key) => setActiveSection(key as NodeEditorSection)}
                className='min-h-0 flex-1 gap-0'
            >
                <Tabs.ListContainer className='mx-4 mb-1 shrink-0 max-[768px]:mx-3'>
                    <Tabs.List aria-label='Node configuration sections'>
                        {SECTION_TABS.map((tab) => (
                            <Tabs.Tab key={tab.id} id={tab.id}>
                                {tab.label}
                                <Tabs.Indicator />
                            </Tabs.Tab>
                        ))}
                    </Tabs.List>
                </Tabs.ListContainer>
                <Scrollable className='min-h-0 flex-1 overflow-x-hidden px-5 pt-3.5 pb-4 max-[768px]:px-4'>
                    <Tabs.Panel id='details' className='mt-0 p-0'>
                        {EditorComponent ? (
                            <>
                                {nodeDescription && (
                                    <p className='mb-3 border-b border-separator pb-3 text-xs text-muted'>
                                        {nodeDescription}
                                    </p>
                                )}
                                <EditorComponent node={node} />
                            </>
                        ) : (
                            <p className='text-sm text-muted'>
                                No editor available for this node type.
                            </p>
                        )}
                    </Tabs.Panel>
                    <Tabs.Panel id='connectors' className='mt-0 p-0'>
                        <ConnectorLayoutEditor node={node} />
                    </Tabs.Panel>
                </Scrollable>
            </Tabs>
            <div className='shrink-0 border-t border-separator px-4 pt-3 pb-4'>
                <Alert
                    status='danger'
                    role='region'
                    aria-label='Delete Node'
                    className='flex-row items-center justify-between gap-3 rounded-xl border-0 bg-danger-soft py-3 pr-2 pl-5 shadow-none'
                >
                    <Alert.Content className='gap-0.5'>
                        <Alert.Title<'h2'> render={(props) => <h2 {...props} />} className='text-base font-semibold text-danger-soft-foreground'>
                            Delete Node
                        </Alert.Title>
                        <Alert.Description<'p'> render={(props) => <p {...props} />} className='text-xs text-muted'>
                            Remove this node and its connections
                        </Alert.Description>
                    </Alert.Content>
                    <Button variant='ghost' size='sm' className='shrink-0 text-danger-soft-foreground' onPress={handleDelete}>
                        <Trash2 size={14} aria-hidden='true' />
                        Delete
                    </Button>
                </Alert>
            </div>
        </>
    );
};

export default NodeEditor;
