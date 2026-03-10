FROM ubuntu:25.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libfmt10 \
    libhwloc15 \
    libhwloc-plugins \
    libspdlog1.15 \
    libtbb12 \
    libtbbbind-2-5 \
    libtbbmalloc2 \
    && rm -rf /var/lib/apt/lists/*

CMD ["bash"]
