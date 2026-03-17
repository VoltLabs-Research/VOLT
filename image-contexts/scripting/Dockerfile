FROM quay.io/jupyter/scipy-notebook:latest

ENTRYPOINT []

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

USER ${NB_UID}

RUN pip install --no-cache-dir msgpack pandas vtk minio voltsdk==2.0.0