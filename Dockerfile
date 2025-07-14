# docker build -t opendxa . (--no-cache)
# docker run -v $(pwd)/data:/data --rm opendxa ./opendxa dump analysis.json

# Build stage
FROM ubuntu:24.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    ninja-build \
    git \
    python3-dev \
    python3-pip \
    pybind11-dev \
    libeigen3-dev \
    libtbb-dev \
    libomp-dev \
    libspdlog-dev \
    libboost-dev \
    gcc-14 \
    g++-14 \
    && rm -rf /var/lib/apt/lists/* 

RUN update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-14 100 && \
    update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-14 100

WORKDIR /app

COPY opendxa/CMakeLists.txt opendxa/
COPY opendxa/src/ opendxa/src/
COPY opendxa/dependencies/ptm opendxa/dependencies/ptm
COPY opendxa/dependencies/geogram opendxa/dependencies/geogram
COPY opendxa/include/ opendxa/include/
COPY bindings/python/opendxa_py/ bindings/python/opendxa_py/

RUN mkdir -p opendxa/dependencies && \
    cd opendxa/dependencies && \
    git clone https://github.com/nlohmann/json.git json && \
    cd json && git checkout v3.11.3 && cd .. && \
    git clone --depth 1 https://github.com/pybind/pybind11_json pybind11_json && \
    cd ../..

RUN cd opendxa && \
    mkdir -p build && \
    cd build && \
    cmake -DCMAKE_BUILD_TYPE=Release .. && \
    make -j$(nproc)

# Runtime stage
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    libstdc++6 \
    libtbb12 \
    libgomp1 \
    libspdlog1.12 \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/opendxa/build/opendxa .

RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

CMD ["./opendxa"]