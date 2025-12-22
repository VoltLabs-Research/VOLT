#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/core/simulation_cell.h>
#include <opendxa/math/lin_alg.h>
#include <fstream>

namespace OpenDXA{

class LammpsParser{
public:
    LammpsParser(){}

    struct Frame{
        int timestep;
        int natoms;
        SimulationCell simulationCell;
        std::vector<Point3> positions;
        std::vector<int> types;
        std::vector<int> ids;
    };

    bool parseFile(const std::string &filename, Frame &frame);

private:
    bool parseStream(std::istream &in, Frame &frame);
    bool readHeader(std::istream &in, Frame &f);
    bool readBoxBounds(std::istream &in, Frame &f);
    bool readAtomData(std::istream &in, Frame &f);

    std::vector<std::string> parseColumns(const std::string &line);

    int findColumn(const std::vector<std::string> &cols, const std::string &name);
};

}
