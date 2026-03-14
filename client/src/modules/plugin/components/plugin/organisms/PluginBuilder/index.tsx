import PaletteItem from '@/modules/plugin/components/plugin/atoms/PaletteItem';
import PluginBuilderCanvas from '@/modules/plugin/components/plugin/organisms/PluginBuilderCanvas';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { IModifierData } from '@/modules/plugin/api/entities/plugin/workflow';
import useSaveWorkflow from '@/modules/plugin/hooks/plugin/use-save-workflow';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { NODE_CONFIGS } from '@/modules/plugin/utilities/plugin/node-registry';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import EditableTag from '@/shared/presentation/components/EditableTag';
import Sidebar from '@/shared/presentation/components/Sidebar';
import Tooltip from '@/shared/presentation/components/Tooltip';
import useConfirm from '@/shared/presentation/hooks/use-confirm';
import useKeyboardShortcut from '@/shared/presentation/hooks/use-keyboard-shortcut';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { DragEvent, ReactNode } from 'react';
import '@xyflow/react/dist/style.css';
import './PluginBuilder.css';

const nodeTypesList = Object.values(NODE_CONFIGS);

interface PluginBuilderProps {
    onBack: () => void;
    bottomSidebarContent?: ReactNode;
};

const PluginBuilder = ({ onBack, bottomSidebarContent }: PluginBuilderProps) => {
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const saveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { confirm } = useConfirm();

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

    const saveWorkflow = useSaveWorkflow();
    const isSaving = usePluginBuilderStore((state) => state.isSaving);

    const clearSaveStatusTimeout = useCallback(() => {
        if (!saveStatusTimeoutRef.current) {
            return;
        }

        clearTimeout(saveStatusTimeoutRef.current);
        saveStatusTimeoutRef.current = null;
    }, []);

    useEffect(() => {
        return () => {
            clearSaveStatusTimeout();
        };
    }, [clearSaveStatusTimeout]);

    const handleSave = useCallback(async () => {
        if (isSaving) return;

        clearSaveStatusTimeout();
        setSaveStatus('saving');
        try {
            const result = await saveWorkflow();
            if (result) {
                setSaveStatus('saved');
                setHasUnsavedChanges(false);
                saveStatusTimeoutRef.current = setTimeout(() => {
                    setSaveStatus('idle');
                    saveStatusTimeoutRef.current = null;
                }, 2000);
            } else {
                setSaveStatus('error');
                saveStatusTimeoutRef.current = setTimeout(() => {
                    setSaveStatus('idle');
                    saveStatusTimeoutRef.current = null;
                }, 3000);
            }
        } catch {
            setSaveStatus('error');
            saveStatusTimeoutRef.current = setTimeout(() => {
                setSaveStatus('idle');
                saveStatusTimeoutRef.current = null;
            }, 3000);
        }
    }, [clearSaveStatusTimeout, saveWorkflow, isSaving]);

    useKeyboardShortcut('s', handleSave, { ctrl: true });

    const handleEscape = useCallback(() => {
        if (selectedNode) selectNode(null);
    }, [selectedNode, selectNode]);

    const handleDeleteSelected = useCallback(() => {
        if (selectedNode) deleteNode(selectedNode.id);
    }, [selectedNode, deleteNode]);

    const handleUndo = useCallback(() => { undo(); }, [undo]);
    const handleRedo = useCallback(() => { redo(); }, [redo]);

    useKeyboardShortcut('Escape', handleEscape, { preventDefault: false });
    useKeyboardShortcut('Delete', handleDeleteSelected, { preventDefault: false });
    useKeyboardShortcut('z', handleUndo, { ctrl: true });
    useKeyboardShortcut('z', handleRedo, { ctrl: true, shift: true });

    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        setHasUnsavedChanges(true);
    }, [nodes.length]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!hasUnsavedChanges) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const handleAddNode = useCallback((nodeType: NodeType) => {
        const offset = nodes.length * 20;
        addNode(nodeType, { x: 150 + offset, y: 150 + offset });
    }, [addNode, nodes.length]);

    const modifierNode = useMemo(() => {
        return nodes.find(n => n.type === NodeType.MODIFIER);
    }, [nodes]);

    const pluginName = useMemo(() => {
        return modifierNode?.data.modifier?.name || 'New Plugin';
    }, [modifierNode]);

    const handlePluginNameChange = useCallback((newName: string) => {
        if (modifierNode) {
            const currentModifier: IModifierData = modifierNode.data.modifier ?? { name: pluginName };
            updateNodeData(modifierNode.id, {
                modifier: {
                    ...currentModifier,
                    name: newName
                }
            });
        }
    }, [modifierNode, pluginName, updateNodeData]);

    const onDragStart = useCallback((event: DragEvent, nodeType: NodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleBackClick = useCallback(() => {
        const goBack = async () => {
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

        goBack().catch(() => undefined);
    }, [confirm, hasUnsavedChanges, onBack]);

    const SIDEBAR_TAGS = useMemo(() => [
        {
            id: 'Palette',
            name: 'Palette',
            Component: () => (
                <Container className='d-flex column gap-1-5 plugin-builder-palette-list-container p-2'>
                    {nodeTypesList.map((config) => (
                        <PaletteItem config={config} onDragStart={onDragStart} onAdd={handleAddNode} key={config.type} />
                    ))}
                </Container>
            )
        }
    ], [onDragStart, handleAddNode]);

    return (
        <Container className='wh-max vh-max'>
            <Sidebar
                tags={SIDEBAR_TAGS}
                activeTag='Palette'
                className='primary-surface'
            >
                <Sidebar.Header>
                    <Container className='d-flex items-center gap-075'>
                        <Tooltip content='Back' placement='right'>
                            <Button
                                variant='ghost'
                                intent='neutral'
                                iconOnly
                                size='sm'
                                aria-label='Back'
                                onClick={handleBackClick}
                                title='Back'
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
                    </Container>
                </Sidebar.Header>

                <Sidebar.Bottom>
                    {bottomSidebarContent}
                </Sidebar.Bottom>
            </Sidebar>

            <PluginBuilderCanvas saveStatus={saveStatus} onSave={handleSave} />
        </Container>
    );
};

export default PluginBuilder;
