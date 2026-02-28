import { useCallback } from 'react';
import usePluginUseCases from './use-plugin-use-cases';
import usePluginStore from '../stores/use-plugin-store';
import usePluginBuilderStore from '../stores/use-plugin-builder-store';
import { showPromise } from '@/shared/presentation/hooks/toast';
import type { Plugin } from '../../domain/entities';

const useSaveWorkflow = () => {
    const { pluginRepository } = usePluginUseCases();

    const getWorkflow = usePluginBuilderStore((state) => state.getWorkflow);
    const currentPluginId = usePluginBuilderStore((state) => state.currentPluginId);
    const setSaving = usePluginBuilderStore((state) => state.setSaving);
    const setSaveError = usePluginBuilderStore((state) => state.setSaveError);
    const setCurrentPluginId = usePluginBuilderStore((state) => state.setCurrentPluginId);

    const addPlugin = usePluginStore((state) => state.addPlugin);
    const updatePluginInStore = usePluginStore((state) => state.updatePlugin);

    const saveWorkflow = useCallback(async (): Promise<Plugin | null> => {
        setSaving(true);
        setSaveError(null);

        try {
            const workflow = getWorkflow();
            const isUpdate = !!currentPluginId;

            const action = async () => {
                if (currentPluginId) {
                    return await pluginRepository.update({
                        id: currentPluginId,
                        workflow
                    });
                } else {
                    return await pluginRepository.create({ workflow });
                }
            };

            const plugin = await showPromise(action(), {
                loading: { title: isUpdate ? 'Saving workflow...' : 'Creating workflow...' },
                success: { title: isUpdate ? 'Workflow saved' : 'Workflow created' },
                error: { title: 'Failed to save workflow' }
            });

            if (currentPluginId) {
                updatePluginInStore(currentPluginId, plugin);
            } else {
                addPlugin(plugin);
                setCurrentPluginId(plugin._id);
            }

            return plugin;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save workflow';
            setSaveError(message);
            return null;
        } finally {
            setSaving(false);
        }
    }, [
        getWorkflow,
        currentPluginId,
        pluginRepository,
        setSaving,
        setSaveError,
        setCurrentPluginId,
        addPlugin,
        updatePluginInStore
    ]);

    return saveWorkflow;
};

export default useSaveWorkflow;
