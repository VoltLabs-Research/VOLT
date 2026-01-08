import { useEffect } from 'react';
import { usePageTitle } from '@/hooks/core/use-page-title';
import { useSearchParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import PluginBuilder from '@/features/plugins/components/organisms/PluginBuilder';
import { usePluginBuilderStore } from '@/features/plugins/stores/builder-slice';

const PluginBuilderPage = () => {
    usePageTitle('Plugin Builder');
    const [searchParams] = useSearchParams();
    const pluginId = searchParams.get('id');
    const loadPluginById = usePluginBuilderStore((state) => state.loadPluginById);
    const clearWorkflow = usePluginBuilderStore((state) => state.clearWorkflow);

    useEffect(() => {
        if (pluginId) {
            loadPluginById(pluginId);
        } else {
            clearWorkflow();
        }
    }, [pluginId, loadPluginById, clearWorkflow]);

    return (
        <ReactFlowProvider>
            <PluginBuilder />
        </ReactFlowProvider>
    );
};

export default PluginBuilderPage;
