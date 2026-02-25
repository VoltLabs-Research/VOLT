FROM quay.io/jupyter/scipy-notebook:latest

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --chown=${NB_UID}:${NB_GID} voltsdk /opt/voltsdk

USER ${NB_UID}

RUN pip install --no-cache-dir msgpack pandas vtk minio /opt/voltsdk
