import { useCallback, useMemo, useState, type DragEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { NodeType } from '@/modules/plugin/domain/entities';
import { NODE_CONFIGS } from '@/modules/plugin/presentation/utilities/node-types';
import { usePluginBuilderStore } from '@/modules/plugin/presentation/stores/use-plugin-builder-store';
import { useSaveWorkflow } from '@/modules/plugin/presentation/hooks';
import useKeyboardShortcut from '@/shared/presentation/hooks/use-keyboard-shortcut';
import PaletteItem from '@/modules/plugin/presentation/components/atoms/PaletteItem';
import NodeEditor from '@/modules/plugin/presentation/components/molecules/NodeEditor';
import PluginBuilderCanvas from './components/PluginBuilderCanvas';
import Sidebar from '@/shared/presentation/components/Sidebar';
import EditableTag from '@/shared/presentation/components/EditableTag';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Title from '@/shared/presentation/components/Title';
import UserMenuPopover from '@/modules/auth/presentation/components/molecules/UserMenuPopover';
import { TbArrowLeft } from 'react-icons/tb';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/modules/auth/presentation/stores/use-auth-store';
import '@xyflow/react/dist/style.css';
import './PluginBuilder.css';

const nodeTypesList = Object.values(NODE_CONFIGS);

const PluginBuilder = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('Palette');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const signOut = useAuthStore((state) => state.signOut);
    const [isSigningOut, setIsSigningOut] = useState(false);

    const {
        nodes,
        selectedNode,
        selectNode,
        updateNodeData
    } = usePluginBuilderStore(
        useShallow((state) => ({
            nodes: state.nodes,
            selectedNode: state.selectedNode,
            selectNode: state.selectNode,
            updateNodeData: state.updateNodeData
        }))
    );

    const saveWorkflow = useSaveWorkflow();
    const isSaving = usePluginBuilderStore((state) => state.isSaving);

    const handleSave = useCallback(async () => {
        if (isSaving) return;
        setSaveStatus('saving');
        try {
            const result = await saveWorkflow();
            if (result) {
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } else {
                setSaveStatus('error');
                setTimeout(() => setSaveStatus('idle'), 3000);
            }
        } catch {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    }, [saveWorkflow, isSaving]);

    useKeyboardShortcut('s', handleSave, { ctrl: true });

    const modifierNode = useMemo(() => {
        return nodes.find(n => n.type === NodeType.MODIFIER);
    }, [nodes]);

    const pluginName = useMemo(() => {
        const modifierData = modifierNode?.data as { modifier?: { name?: string } } | undefined;
        return modifierData?.modifier?.name || 'New Plugin';
    }, [modifierNode]);

    const handlePluginNameChange = useCallback((newName: string) => {
        if (modifierNode) {
            const currentData = modifierNode.data as { modifier?: Record<string, unknown> } | undefined;
            updateNodeData(modifierNode.id, {
                modifier: { ...currentData?.modifier, name: newName }
            });
        }
    }, [modifierNode, updateNodeData]);

    const onDragStart = useCallback((event: DragEvent, nodeType: NodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleClearSelection = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    const handleSignOut = useCallback(async () => {
        try {
            setIsSigningOut(true);
            await signOut();
        } finally {
            setIsSigningOut(false);
        }
    }, [signOut]);

    const handleSettingsClick = useCallback(() => {
        navigate('/dashboard/settings/general');
    }, [navigate]);

    const selectedNodeConfig = selectedNode ? NODE_CONFIGS[selectedNode.type as NodeType] : null;

    const SIDEBAR_TAGS = useMemo(() => [
        {
            id: 'Palette',
            name: 'Palette',
            Component: () => (
                <Container className='d-flex column gap-1-5 plugin-builder-palette-list-container p-2'>
                    {nodeTypesList.map((config) => (
                        <PaletteItem config={config} onDragStart={onDragStart} key={config.type} />
                    ))}
                </Container>
            )
        },
        {
            id: 'Options',
            name: 'Options',
            Component: () => (
                <Container className='p-2'>
                    <Title className='color-muted font-size-2'>
                        Select a node or add global plugin options here.
                    </Title>
                </Container>
            )
        }
    ], [onDragStart]);

    return (
        <Container className='wh-max vh-max'>
            <Sidebar
                tags={SIDEBAR_TAGS}
                activeTag={activeTab}
                onTagChange={setActiveTab}
                className='primary-surface'
                overrideContent={selectedNode ? <NodeEditor node={selectedNode} /> : null}
            >
                <Sidebar.Header>
                    {selectedNode ? (
                        <Container className='d-flex items-center gap-075'>
                            <Tooltip content='Back to Palette' placement='right'>
                                <Button
                                    variant='ghost'
                                    intent='neutral'
                                    iconOnly
                                    size='sm'
                                    onClick={handleClearSelection}
                                >
                                    <TbArrowLeft size={18} />
                                </Button>
                            </Tooltip>
                            <Title className='font-weight-6'>{selectedNodeConfig?.label}</Title>
                        </Container>
                    ) : (
                        <Tooltip content='Double-click to edit plugin name' placement='bottom'>
                            <EditableTag
                                as='h3'
                                onSave={handlePluginNameChange}
                            >
                                {pluginName}
                            </EditableTag>
                        </Tooltip>
                    )}
                </Sidebar.Header>

                <Sidebar.Bottom>
                    <Container className='editor-sidebar-user-avatar-wrapper p-1-5'>
                        <UserMenuPopover
                            onSettingsClick={handleSettingsClick}
                            onSignOut={handleSignOut}
                            isSigningOut={isSigningOut}
                        />
                    </Container>
                </Sidebar.Bottom>
            </Sidebar>

            <PluginBuilderCanvas saveStatus={saveStatus} onSave={handleSave} />
        </Container>
    );
};

export default PluginBuilder;
