FROM quay.io/jupyter/scipy-notebook:latest

ENTRYPOINT []

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

USER ${NB_UID}

RUN python -m pip install --no-cache-dir \
    jupyterlab==4.5.8 \
    minio==7.2.20 \
    pyarrow==24.0.0 \
    pandas==2.3.3 \
    vtk==9.6.2 \
    voltsdk==3.1.1 \
    ovito==3.15.4 \
    ase==3.28.0 \
    pymatgen==2026.5.4 \
    MDAnalysis==2.10.0 \
    matminer==0.10.1
