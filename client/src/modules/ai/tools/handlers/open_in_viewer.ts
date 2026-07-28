import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';

interface OpenInViewerInput {
    trajectoryId?: string;
    analysisId?: string;
    ownerId?: string;
}

const openInViewer: ClientToolHandler<OpenInViewerInput> = {
    name: 'open_in_viewer',

    run(input, ctx): ClientToolResult {
        const trajectoryId = typeof input.trajectoryId === 'string' ? input.trajectoryId.trim() : '';

        if (!trajectoryId) {
            return {
                ok: false,
                summary: 'Could not open the viewer.',
                reason: 'missing_trajectory_id',
                hint: 'A trajectoryId is required. Resolve one with global_search / list_* first.'
            };
        }

        const encodedTrajectoryId = encodeURIComponent(trajectoryId);
        const ownerId = typeof input.ownerId === 'string' ? input.ownerId.trim() : '';
        const analysisId = typeof input.analysisId === 'string' ? input.analysisId.trim() : '';

        let path = `/canvas/${encodedTrajectoryId}`;

        if (ownerId) {
            path += `/workspace/${encodeURIComponent(ownerId)}`;
        }

        if (analysisId) {
            path += `?analysis=${encodeURIComponent(analysisId)}`;
        }

        ctx.navigate(path);

        return {
            ok: true,
            summary: 'Opened the trajectory in the 3D viewer.',
            data: {
                path,
                trajectoryId,
                ownerId: ownerId || undefined,
                analysisId: analysisId || undefined
            }
        };
    },

    describeEffect(_input, result) {
        if (!result.ok) {
            return {
                label: 'Could not open viewer',
                icon: 'viewer'
            };
        }
        return {
            label: 'Opened trajectory in viewer',
            icon: 'viewer'
        };
    }
};

export default openInViewer;
