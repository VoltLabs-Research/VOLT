FROM quay.io/jupyter/scipy-notebook:latest

ENTRYPOINT []

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

USER ${NB_UID}

RUN python -m pip install --no-cache-dir --upgrade \
    jupyterlab \
    minio \
    msgpack \
    pandas \
    vtk \
    voltsdk \
    ovito \
    ase \
    pymatgen \
    MDAnalysis \
    matminer
