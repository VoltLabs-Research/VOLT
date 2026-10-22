"""matplotlib's backend in VOLT's notebooks (MPLBACKEND=module://_volt_matplotlib): Agg's canvas,
with plt.show() showing the open figures as images of the running cell's output."""

from matplotlib.backend_bases import _Backend
from matplotlib.backends.backend_agg import _BackendAgg

import volt_kernel


@_Backend.export
class _BackendVolt(_BackendAgg):
    @classmethod
    def show(cls, *args, **kwargs):
        volt_kernel.show_figures()
