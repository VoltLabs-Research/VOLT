#pragma once

#include <fstream>
#include <vector>
#include <cstdint>
#include <string>
#include <stdexcept>
#include <zstd.h>
#include <thread>

namespace OpenDXA{

void compressDumpToZstd(const std::string& dumpFile, const std::string &outFile){
    std::ifstream in(dumpFile);
    if(!in) throw std::runtime_error("Cannot open " + dumpFile);

    std::vector<char> raw;
    std::vector<uint64_t> offsets;
    uint32_t nAtoms = 0;

    auto reserveOnce = [&](size_t n){
        if(raw.capacity() < n) raw.reserve(n);
    };

    std::string line;
    while(std::getline(in, line)){
        if(line.rfind("ITEM: TIMESTEP", 0) != 0) continue;
        // Timestep value
        std::getline(in, line);

        // "ITEM: NUMBER OF ATOMS"
        std::getline(in, line);
        std::getline(in, line);

        const uint32_t atomsThis = std::stoi(line);
        if(nAtoms == 0){
            nAtoms = atomsThis;
        }else if(nAtoms != atomsThis){
            throw std::runtime_error("Atom count changes between frames");
        }

        // Box bounds
        std::getline(in, line);
        for(int i = 0; i < 3; ++i) std::getline(in, line);

        // TODO: 
        // "ITEM: ATOMS id type x y z"
        std::getline(in, line);

        offsets.push_back(raw.size());
        reserveOnce(raw.size() + atomsThis * 12);
        
        for(uint32_t i = 0; i < atomsThis; ++i){
            std::getline(in, line);
            int id, type;
            float x, y, z;
            std::sscanf(line.c_str(), "%d %d %f %f %f", &id, &type, &x, &y, &z);
                        raw.insert(raw.end(),
                        reinterpret_cast<char*>(&x),
                        reinterpret_cast<char*>(&x) + sizeof(float));
            raw.insert(raw.end(),
                        reinterpret_cast<char*>(&y),
                        reinterpret_cast<char*>(&y) + sizeof(float));
            raw.insert(raw.end(),
                        reinterpret_cast<char*>(&z),
                        reinterpret_cast<char*>(&z) + sizeof(float));
        }
    }

    const uint32_t nFrames = static_cast<uint32_t>(offsets.size());
    const uint64_t headerSz = 8 + 8ull * nFrames;

    raw.insert(raw.begin(), headerSz, 0);
    std::memcpy(raw.data() + 0, &nFrames, 4);
    std::memcpy(raw.data() + 4, &nAtoms , 4);
    std::memcpy(raw.data() + 8, offsets.data(), offsets.size() * 8);

    size_t const maxZSTD = ZSTD_compressBound(raw.size());
    std::vector<char> zst(maxZSTD);
    ZSTD_CCtx* cctx = ZSTD_createCCtx();
    if(!cctx) throw std::runtime_error("ZSTD_createCCtx() failed");

    ZSTD_CCtx_setParameter(cctx, ZSTD_c_compressionLevel, ZSTD_maxCLevel());
    ZSTD_CCtx_setParameter(cctx, ZSTD_c_nbWorkers, static_cast<int>(std::thread::hardware_concurrency()));
    ZSTD_CCtx_setParameter(cctx, ZSTD_c_enableLongDistanceMatching, 1);      
    ZSTD_CCtx_setParameter(cctx, ZSTD_c_windowLog, 31);
    ZSTD_CCtx_setParameter(cctx, ZSTD_c_checksumFlag, 1);

    size_t zsize = ZSTD_compress2(cctx, zst.data(), zst.size(), raw.data(), raw.size());

    if(ZSTD_isError(zsize)){
        throw std::runtime_error(std::string("ZSTD_compress2: ") + ZSTD_getErrorName(zsize));
    }

    zst.resize(zsize);
    ZSTD_freeCCtx(cctx);

    std::ofstream out(outFile, std::ios::binary);
    if(!out) throw std::runtime_error("Cannot create " + outFile);
    out.write(zst.data(), zst.size());
    out.close();
}

}