import { useCallback, useMemo, useState, useRef, useEffect, type DragEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { NodeType } from '@/modules/plugin/api/entities/workflow-enums';
import { NODE_CONFIGS } from '@/modules/plugin/utilities/node-types';
import { usePluginBuilderStore } from '@/modules/plugin/stores/use-plugin-builder-store';
import useSaveWorkflow from '@/modules/plugin/hooks/use-save-workflow';
import useKeyboardShortcut from '@/shared/presentation/hooks/use-keyboard-shortcut';
import PaletteItem from '@/modules/plugin/components/atoms/PaletteItem';
import PluginBuilderCanvas from '@/modules/plugin/components/organisms/PluginBuilderCanvas';
import Sidebar from '@/shared/presentation/components/Sidebar';
import EditableTag from '@/shared/presentation/components/EditableTag';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import UserMenuPopover from '@/modules/auth/components/molecules/UserMenuPopover';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import '@xyflow/react/dist/style.css';
import './PluginBuilder.css';

const nodeTypesList = Object.values(NODE_CONFIGS);

const PluginBuilder = () => {
    const navigate = useNavigate();
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const signOut = useAuthStore((state) => state.signOut);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const saveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                                onClick={() => {
                                    if (hasUnsavedChanges && !window.confirm('You have unsaved changes. Leave anyway?')) return;
                                    navigate(-1);
                                }}
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
