import PaletteItem from '@/modules/plugin/components/plugin/atoms/PaletteItem';
import PluginBuilderCanvas from '@/modules/plugin/components/plugin/organisms/PluginBuilderCanvas';
import { PluginBuilderSaveStatus } from '@/modules/plugin/components/plugin/organisms/PluginBuilder/save-status';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { IModifierData } from '@/modules/plugin/api/entities/plugin/workflow';
import useSaveWorkflow from '@/modules/plugin/hooks/plugin/use-save-workflow';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { NODE_CONFIGS } from '@/modules/plugin/utilities/plugin/node-registry';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Sidebar from '@/shared/presentation/components/Sidebar';
import Tooltip from '@/shared/presentation/components/Tooltip';
import useKeyboardShortcut from '@/shared/presentation/hooks/use-keyboard-shortcut';
import { ArrowLeft, Check, PencilLine, Save, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ChangeEvent, DragEvent, KeyboardEvent, ReactNode } from 'react';
import '@xyflow/react/dist/style.css';
import './PluginBuilder.css';

const nodeTypesList = Object.values(NODE_CONFIGS);

const DEFAULT_PLUGIN_NAME = 'New Plugin';

interface PluginBuilderProps {
    onBack: () => void;
    bottomSidebarContent?: ReactNode;
};

interface HeaderStatusConfig {
    detail: string;
    label: string;
    modifierClassName: string;
};

const PluginBuilder = ({ onBack, bottomSidebarContent }: PluginBuilderProps) => {
    const [saveStatus, setSaveStatus] = useState<PluginBuilderSaveStatus>(PluginBuilderSaveStatus.Idle);
    const [isEditingPluginName, setIsEditingPluginName] = useState(false);
    const [pluginNameDraft, setPluginNameDraft] = useState(DEFAULT_PLUGIN_NAME);
    const saveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pluginNameInputRef = useRef<HTMLInputElement | null>(null);
    const pluginNameBeforeEditingRef = useRef(DEFAULT_PLUGIN_NAME);

    const { nodes, updateNodeData, selectedNode, selectNode, deleteNode, addNode, undo, redo, isDirty, isSaving } = usePluginBuilderStore(
        useShallow((state) => ({
            nodes: state.nodes,
            updateNodeData: state.updateNodeData,
            selectedNode: state.selectedNode,
            selectNode: state.selectNode,
            deleteNode: state.deleteNode,
            addNode: state.addNode,
            undo: state.undo,
            redo: state.redo,
            isDirty: state.isDirty,
            isSaving: state.isSaving
        }))
    );

    const saveWorkflow = useSaveWorkflow();

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

    useEffect(() => {
        if (!isDirty || saveStatus !== PluginBuilderSaveStatus.Saved) {
            return;
        }

        clearSaveStatusTimeout();
        setSaveStatus(PluginBuilderSaveStatus.Idle);
    }, [clearSaveStatusTimeout, isDirty, saveStatus]);

    const handleSave = useCallback(async () => {
        if (isSaving) return;

        clearSaveStatusTimeout();
        setSaveStatus(PluginBuilderSaveStatus.Saving);
        try {
            const result = await saveWorkflow();
            if (result) {
                setSaveStatus(PluginBuilderSaveStatus.Saved);
                saveStatusTimeoutRef.current = setTimeout(() => {
                    setSaveStatus(PluginBuilderSaveStatus.Idle);
                    saveStatusTimeoutRef.current = null;
                }, 2000);
            } else {
                setSaveStatus(PluginBuilderSaveStatus.Error);
                saveStatusTimeoutRef.current = setTimeout(() => {
                    setSaveStatus(PluginBuilderSaveStatus.Idle);
                    saveStatusTimeoutRef.current = null;
                }, 3000);
            }
        } catch {
            setSaveStatus(PluginBuilderSaveStatus.Error);
            saveStatusTimeoutRef.current = setTimeout(() => {
                setSaveStatus(PluginBuilderSaveStatus.Idle);
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

    useEffect(() => {
        if (!isEditingPluginName || !pluginNameInputRef.current) {
            return;
        }

        pluginNameInputRef.current.focus();
        pluginNameInputRef.current.select();
    }, [isEditingPluginName]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!isDirty) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    const handleAddNode = useCallback((nodeType: NodeType) => {
        const offset = nodes.length * 20;
        addNode(nodeType, { x: 150 + offset, y: 150 + offset });
    }, [addNode, nodes.length]);

    const modifierNode = useMemo(() => {
        return nodes.find((node) => node.type === NodeType.MODIFIER);
    }, [nodes]);

    const pluginName = useMemo(() => {
        return modifierNode?.data.modifier?.name || DEFAULT_PLUGIN_NAME;
    }, [modifierNode]);

    useEffect(() => {
        if (isEditingPluginName) {
            return;
        }

        setPluginNameDraft(pluginName);
    }, [isEditingPluginName, pluginName]);

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

    const handleStartPluginNameEditing = useCallback(() => {
        pluginNameBeforeEditingRef.current = pluginName;
        setPluginNameDraft(pluginName);
        setIsEditingPluginName(true);
    }, [pluginName]);

    const handlePluginNameInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const nextPluginName = event.target.value;

        setPluginNameDraft(nextPluginName);
        handlePluginNameChange(nextPluginName);
    }, [handlePluginNameChange]);

    const handleCancelPluginNameEditing = useCallback(() => {
        const previousPluginName = pluginNameBeforeEditingRef.current;

        setPluginNameDraft(previousPluginName);
        handlePluginNameChange(previousPluginName);
        setIsEditingPluginName(false);
    }, [handlePluginNameChange]);

    const handleCommitPluginNameEditing = useCallback(() => {
        const normalizedPluginName = pluginNameDraft.trim();

        if (!normalizedPluginName) {
            handleCancelPluginNameEditing();
            return;
        }

        setPluginNameDraft(normalizedPluginName);
        handlePluginNameChange(normalizedPluginName);
        setIsEditingPluginName(false);
    }, [handleCancelPluginNameEditing, handlePluginNameChange, pluginNameDraft]);

    const handlePluginNameInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleCommitPluginNameEditing();
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            handleCancelPluginNameEditing();
        }
    }, [handleCancelPluginNameEditing, handleCommitPluginNameEditing]);

    const onDragStart = useCallback((event: DragEvent, nodeType: NodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleBackClick = useCallback(() => {
        onBack();
    }, [onBack]);

    const headerStatus = useMemo<HeaderStatusConfig>(() => {
        if (saveStatus === PluginBuilderSaveStatus.Saving || isSaving) {
            return {
                detail: 'Saving changes…',
                label: 'Saving',
                modifierClassName: 'plugin-builder-header-status--saving'
            };
        }

        if (saveStatus === PluginBuilderSaveStatus.Error) {
            return {
                detail: 'Save failed',
                label: 'Error',
                modifierClassName: 'plugin-builder-header-status--error'
            };
        }

        if (isDirty) {
            return {
                detail: 'Unsaved changes',
                label: 'Dirty',
                modifierClassName: 'plugin-builder-header-status--dirty'
            };
        }

        return {
            detail: 'All changes saved',
            label: 'Saved',
            modifierClassName: 'plugin-builder-header-status--saved'
        };
    }, [isDirty, isSaving, saveStatus]);

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
        <Container className='wh-max vh-max d-flex column plugin-builder-shell'>
            <header className='plugin-builder-header d-flex items-center content-between gap-1 p-1-5'>
                <Container className='d-flex items-center gap-1 plugin-builder-header-leading'>
                    <Tooltip content='Back' placement='bottom'>
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

                    <Container className='plugin-builder-title-group d-flex column gap-025'>
                        <Paragraph className='font-size-1 color-secondary plugin-builder-eyebrow'>Plugin Builder</Paragraph>
                        <Container className='d-flex items-center gap-05 plugin-builder-title-row'>
                            {isEditingPluginName ? (
                                <input
                                    ref={pluginNameInputRef}
                                    type='text'
                                    value={pluginNameDraft}
                                    onChange={handlePluginNameInputChange}
                                    onKeyDown={handlePluginNameInputKeyDown}
                                    onBlur={handleCommitPluginNameEditing}
                                    className='plugin-builder-title-input'
                                    aria-label='Plugin title'
                                />
                            ) : (
                                <h1 className='plugin-builder-title'>{pluginName}</h1>
                            )}

                            <Container className='d-flex items-center gap-025'>
                                {isEditingPluginName ? (
                                    <>
                                        <Button
                                            variant='ghost'
                                            intent='neutral'
                                            iconOnly
                                            size='sm'
                                            aria-label='Save plugin title'
                                            title='Save plugin title'
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={handleCommitPluginNameEditing}
                                        >
                                            <Check size={16} />
                                        </Button>
                                        <Button
                                            variant='ghost'
                                            intent='neutral'
                                            iconOnly
                                            size='sm'
                                            aria-label='Cancel plugin title edit'
                                            title='Cancel plugin title edit'
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={handleCancelPluginNameEditing}
                                        >
                                            <X size={16} />
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        variant='ghost'
                                        intent='neutral'
                                        iconOnly
                                        size='sm'
                                        aria-label='Edit plugin title'
                                        title={modifierNode ? 'Edit plugin title' : 'Add a Modifier node to edit the plugin title'}
                                        onClick={handleStartPluginNameEditing}
                                        disabled={!modifierNode}
                                    >
                                        <PencilLine size={16} />
                                    </Button>
                                )}
                            </Container>
                        </Container>
                        {!modifierNode && (
                            <Paragraph className='font-size-1 color-secondary'>Add a Modifier node to set the plugin title.</Paragraph>
                        )}
                    </Container>
                </Container>

                <Container className='d-flex items-center gap-075 plugin-builder-header-actions'>
                    <Container className={`d-flex items-center gap-05 plugin-builder-header-status ${headerStatus.modifierClassName}`} role='status' aria-live='polite'>
                        <Container className='plugin-builder-header-status-dot radius-full' aria-hidden='true' />
                        <Container className='d-flex column gap-025'>
                            <Paragraph className='font-size-1 color-secondary plugin-builder-status-label'>{headerStatus.label}</Paragraph>
                            <Paragraph className='font-size-2 plugin-builder-status-detail'>{headerStatus.detail}</Paragraph>
                        </Container>
                    </Container>

                    <Button
                        variant='solid'
                        intent='brand'
                        size='sm'
                        aria-keyshortcuts='Control+S'
                        onClick={handleSave}
                        disabled={isSaving}
                        title='Save workflow (Ctrl+S)'
                        leftIcon={<Save size={16} />}
                    >
                        Save
                    </Button>
                </Container>
            </header>

            <Container className='plugin-builder-workspace p-relative flex-1 min-h-0'>
                <Sidebar
                    tags={SIDEBAR_TAGS}
                    activeTag='Palette'
                    className='primary-surface plugin-builder-sidebar'
                >
                    <Sidebar.Header>
                        <Container className='d-flex column gap-025'>
                            <Paragraph className='font-size-2 font-weight-6 plugin-builder-sidebar-title'>Palette</Paragraph>
                            <Paragraph className='font-size-1 color-secondary plugin-builder-sidebar-description'>Add workflow nodes</Paragraph>
                        </Container>
                    </Sidebar.Header>

                    <Sidebar.Bottom>
                        {bottomSidebarContent}
                    </Sidebar.Bottom>
                </Sidebar>

                <main className='plugin-builder-main' aria-label='Plugin builder workspace'>
                    <PluginBuilderCanvas saveStatus={saveStatus} onSave={handleSave} />
                </main>
            </Container>
        </Container>
    );
};

export default PluginBuilder;
