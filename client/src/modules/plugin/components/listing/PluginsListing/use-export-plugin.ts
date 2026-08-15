import { useExportPluginMutation } from '../../../hooks/plugin/queries';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import useBlobDownload from '@/shared/ui/hooks/use-blob-download';

const EXPORT_PLUGIN_TOAST = createPromiseToastOptions({
    loading: 'Exporting plugin...',
    success: 'Plugin exported successfully',
    error: 'Failed to export plugin'
});

const useExportPlugin = () => {
    const { download } = useBlobDownload(useExportPluginMutation(), {
        toast: EXPORT_PLUGIN_TOAST,
        filename: ({ filename }) => filename
    });

    return download;
};

export default useExportPlugin;
