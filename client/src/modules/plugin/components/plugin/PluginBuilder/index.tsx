import { Box, Button, Row, Stack, Tooltip } from '@voltstack/bravais';
import PaletteItem from '@/modules/plugin/components/plugin/PaletteItem';
import PluginBuilderCanvas from '@/modules/plugin/components/plugin/PluginBuilderCanvas';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import useWorkflowSaveStatus from '@/modules/plugin/hooks/plugin/use-workflow-save-status';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { NODE_CONFIGS } from '@/modules/plugin/utils/plugin/node-registry';
import EditableTag from '@/shared/ui/components/EditableTag';
import Sidebar from '@/shared/ui/components/Sidebar';
import { confirm } from '@/shared/ui/hooks/use-confirm';
import { useKeyboardShortcut } from '@voltstack/bravais';
import useTip from '@/shared/tips/use-tip';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { DragEvent, ReactNode } from 'react';
import '@xyflow/react/dist/style.css';
import './PluginBuilder.css';

const nodeTypesList = Object.values(NODE_CONFIGS);

interface PluginBuilderProps {
    onBack: () => void;
    bottomSidebarContent?: ReactNode;
}

const PluginBuilder = ({ onBack, bottomSidebarContent }: PluginBuilderProps) => {
    const [shortcutsTipTrigger, setShortcutsTipTrigger] = useState(0);

    const { nodes, updateNodeData, selectedNode, selectNode, deleteNode, addNode, undo, redo } = usePluginBuilderStore(
        useShallow((state) => ({
            nodes: state.nodes,
            updateNodeData: state.updateNodeData,
            selectedNode: state.selectedNode,
            selectNode: state.selectNode,
            deleteNode: state.deleteNode,
            addNode: state.addNode,
            undo: state.undo,
            redo: state.redo
        }))
    );

    const { saveStatus, hasUnsavedChanges, save } = useWorkflowSaveStatus();

    useTip('plugin-builder-shortcuts', {
        enabled: shortcutsTipTrigger > 0,
        triggerKey: shortcutsTipTrigger
    });

    const handleEscape = useCallback(() => {
        if (selectedNode) selectNode(null);
    }, [selectedNode, selectNode]);

    const handleDeleteSelected = useCallback(() => {
        if (selectedNode) deleteNode(selectedNode.id);
    }, [selectedNode, deleteNode]);

    useKeyboardShortcut('Escape', handleEscape, { preventDefault: false });
    useKeyboardShortcut('Delete', handleDeleteSelected, { preventDefault: false });
    useKeyboardShortcut('z', undo, { ctrl: true });
    useKeyboardShortcut('z', redo, {
        ctrl: true,
        shift: true
    });

    // Stable identity keeps SIDEBAR_TAGS (and therefore the palette subtree) mounted.
    const handleAddNode = useCallback((nodeType: NodeType) => {
        const offset = usePluginBuilderStore.getState().nodes.length * 20;
        addNode(nodeType, {
            x: 150 + offset,
            y: 150 + offset
        });
        setShortcutsTipTrigger((current) => current + 1);
    }, [addNode]);

    const onDragStart = useCallback((event: DragEvent, nodeType: NodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    }, []);

    const modifierNode = nodes.find((node) => node.type === NodeType.MODIFIER);
    const pluginName = modifierNode?.data.modifier?.name || 'New Plugin';

    const handlePluginNameChange = (newName: string) => {
        if (!modifierNode) {
            return;
        }

        updateNodeData(modifierNode.id, {
            modifier: {
                ...modifierNode.data.modifier ?? { name: pluginName },
                name: newName
            }
        });
    };

    const handleBackClick = useCallback(() => {
        const leaveBuilder = async () => {
            if (hasUnsavedChanges) {
                const isConfirmed = await confirm({
                    title: 'Leave with unsaved changes?',
                    description: 'Your changes have not been saved yet.',
                    confirmText: 'Leave'
                });

                if (!isConfirmed) {
                    return;
                }
            }

            onBack();
        };

        leaveBuilder().catch(() => undefined);
    }, [hasUnsavedChanges, onBack]);

    const SIDEBAR_TAGS = useMemo(() => [
        {
            id: 'Palette',
            name: 'Palette',
            Component: () => (
                <Stack gap='1-5' p='2' className='plugin-builder-palette-list-container'>
                    {nodeTypesList.map((config) => (
                        <PaletteItem config={config} onDragStart={onDragStart} onAdd={handleAddNode} key={config.type} />
                    ))}
                </Stack>
            )
        }
    ], [onDragStart, handleAddNode]);

    return (
        <Box width='vw-max' height='vh-max'>
            <Sidebar
                tags={SIDEBAR_TAGS}
                activeTag='Palette'
            >
                <Sidebar.Header>
                    <Row gap='075'>
                        <Tooltip content='Back' placement='right'>
                            <Button
                                variant='ghost'
                                intent='neutral'
                                iconOnly
                                size='sm'
                                onClick={handleBackClick}
                            >
                                <ArrowLeft size={18} />
                            </Button>
                        </Tooltip>
                        <Tooltip content='Double-click to edit plugin name' placement='bottom'>
                            <EditableTag
                                as='h3'
                                onSave={handlePluginNameChange}
                            >
                                {pluginName}
                            </EditableTag>
                        </Tooltip>
                    </Row>
                </Sidebar.Header>

                <Sidebar.Bottom>
                    {bottomSidebarContent}
                </Sidebar.Bottom>
            </Sidebar>

            <PluginBuilderCanvas saveStatus={saveStatus} onSave={save} />
        </Box>
    );
};

export default PluginBuilder;
