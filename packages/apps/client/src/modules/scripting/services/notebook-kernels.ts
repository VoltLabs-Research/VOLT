// The kernels of the notebooks this window opens when it runs its stack: each runs in a worker of
// the page, in its workspace's environment (@volt/web-runtime's notebook kernels), and stays up while
// the app does, so a notebook keeps its variables when it is left and opened again.
import { NotebookKernel } from '@volt/web-runtime/host/notebook-kernels';
import { runtimeUrl } from 'virtual:volt-web-runtime';
import service from '@/modules/scripting/api/scripting-service';

// What every notebook can import: the SDK the notebook template connects with.
const REQUIREMENTS = ['voltsdk'];

const kernels = new Map<string, Promise<NotebookKernel>>();

const start = (notebookId: string, workspace: string): Promise<NotebookKernel> => {
    const starting = service.createNotebookKernel({ notebookId }).then(({ env }) => (
        new NotebookKernel({ runtimeUrl, workspace, env, requirements: REQUIREMENTS })
    ));
    kernels.set(notebookId, starting);
    starting.catch(() => {
        if(kernels.get(notebookId) === starting){
            kernels.delete(notebookId);
        }
    });
    return starting;
};

export const notebookKernels = {
    // The notebook's kernel, started unless it runs.
    async open(notebookId: string, workspace: string): Promise<NotebookKernel> {
        const running = await kernels.get(notebookId)?.catch(() => null);
        return running && running.state !== 'dead' ? running : start(notebookId, workspace);
    },

    // A new kernel: the notebook's variables are gone, its environment's packages and files stay.
    restart(notebookId: string, workspace: string): Promise<NotebookKernel> {
        this.shutdown(notebookId);
        return start(notebookId, workspace);
    },

    shutdown(notebookId: string): void {
        const running = kernels.get(notebookId);
        kernels.delete(notebookId);
        void running?.then((kernel) => kernel.shutdown(), () => {});
    }
};
