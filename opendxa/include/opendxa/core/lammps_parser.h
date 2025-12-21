#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/core/simulation_cell.h>
#include <opendxa/math/lin_alg.h>
#include <fstream>

namespace OpenDXA{

class LammpsParser{
public:
    LammpsParser(){}

    struct ParseOptions{
        unsigned numThreads = 0;
    };

    struct Frame{
        int timestep;
        int natoms;
        SimulationCell simulationCell;
        std::vector<Point3> positions;
        std::vector<int> types;
        std::vector<int> ids;
    };

    bool parseFile(const std::string &filename, Frame &frame, const ParseOptions &opts);

private:
    struct MappedFile{
        const char* data = nullptr;
        size_t size = 0;
        int fd = -1;
        bool valid = false;

        bool open(const char* path);
        void close();
    };

    struct ColumnMapping{
        int idxId = -1;
        int idxType = -1;
        int idxX = -1;
        int idxY = -1;
        int idxZ = -1;
        int idxXs = -1;
        int idxYs = -1;
        int idxZs = -1;
        int maxIdx = 0;
        
        void computeMaxIdx(){
            maxIdx = std::max({idxId, idxType, idxX, idxY, idxZ, idxXs, idxYs, idxZs});
        }
        
        bool hasScaled() const{
            return idxXs >= 0 && idxYs >= 0 && idxZs >= 0;
        }
    };

    bool parseHeader(const char*& p, const char* end, Frame &frame, ColumnMapping &cols);
    void parseAtomChunk(
        const char* start, 
        const char* chunkEnd, 
        const char* globalEnd, 
        Point3* positions, 
        int* types, 
        int* ids, 
        int startIdx, 
        const ColumnMapping &cols, 
        const AffineTransformation* cellMatrix);
};

}

