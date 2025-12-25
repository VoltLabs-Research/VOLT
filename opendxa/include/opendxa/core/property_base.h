#pragma once

#include <opendxa/core/opendxa.h>
#include <boost/range/iterator_range_core.hpp>
#include <boost/dynamic_bitset.hpp>
#include <memory>
#include <cstddef>
#include <cstdint>
#include <vector>
#include <cassert>
#include <cstring>
#include <algorithm>

namespace OpenDXA::Particles{

enum class DataType : int{
    Void = 0,
    Int = 2,
    Double = 6,
    Int64= 7 
};

class PropertyBase{
public:
    PropertyBase();
    PropertyBase(std::size_t count,
                DataType dataType,
                std::size_t componentCount,
                std::size_t stride,
                bool initializeMemory);
    PropertyBase(const PropertyBase& other);
    ~PropertyBase();

    [[nodiscard]] std::size_t size() const noexcept{
        return _numElements;
    }

    [[nodiscard]] DataType dataType() const noexcept{
        return _dataType;
    }

    [[nodiscard]] std::size_t dataTypeSize() const noexcept{
        return _dataTypeSize;
    }

    [[nodiscard]] std::size_t stride() const noexcept{
        return _stride;
    }
    
    [[nodiscard]] const std::int64_t* constDataInt64() const noexcept{
        return reinterpret_cast<const std::int64_t*>(constData());
    }
    
    std::int64_t* dataInt64() noexcept{
        return reinterpret_cast<std::int64_t*>(data());
    }
      [[nodiscard]] std::int64_t getInt64(std::size_t idx) const{
        return constDataInt64()[idx];
    }
    void setInt64(std::size_t idx, std::int64_t v){
        dataInt64()[idx] = v;
    }

    std::int64_t getInt64Component(std::size_t index, std::size_t componentIndex) const{
        return constDataInt64()[index * _componentCount + componentIndex];
    }
    void setInt64Component(std::size_t index, std::size_t componentIndex, std::int64_t v){
        dataInt64()[index * _componentCount + componentIndex] = v;
    }
    [[nodiscard]] std::size_t componentCount() const noexcept{
        return _componentCount;
    }

    [[nodiscard]] const void* constData() const noexcept{
        return _data.get();
    }

    [[nodiscard]] const int* constDataInt() const noexcept{
        return reinterpret_cast<const int*>(constData());
    }

    [[nodiscard]] const double* constDataDouble() const noexcept{
        return reinterpret_cast<const double*>(constData());
    }

    [[nodiscard]] const Point3* constDataPoint3() const noexcept{
        return reinterpret_cast<const Point3*>(constData());
    }

    [[nodiscard]] Vector3* dataVector3(){
        return reinterpret_cast<Vector3*>(data());
    }

    [[nodiscard]] boost::iterator_range<const Point3*> constPoint3Range() const{
        return { constDataPoint3(), constDataPoint3() + _numElements };
    }

    void* data() noexcept{
        return _data.get();
    }

    int* dataInt() noexcept{
        return reinterpret_cast<int*>(data());
    }

    double* dataDouble() noexcept{
        return reinterpret_cast<double*>(data());
    }

    Point3* dataPoint3() noexcept{
        return reinterpret_cast<Point3*>(data()); 
    }

    Point3I* dataPoint3I() noexcept{
        return reinterpret_cast<Point3I*>(data());
    }

    SymmetricTensor2* dataSymmetricTensor2() noexcept{
        return reinterpret_cast<SymmetricTensor2*>(data());
    }   

    Matrix3* dataMatrix3() noexcept{
        return reinterpret_cast<Matrix3*>(data());
    }

    Quaternion* dataQuaternion() noexcept{
        return reinterpret_cast<Quaternion*>(data());
    }

    void setSymmetricTensor2(std::size_t idx, const SymmetricTensor2& t){
        assert(idx < _numElements);
        dataSymmetricTensor2()[idx] = t;
    }

    boost::iterator_range<Point3*> point3Range(){
        return { dataPoint3(), dataPoint3() + _numElements };
    }

    [[nodiscard]] int getInt(std::size_t idx) const{
        //assert(idx < _numElements);
        return constDataInt()[idx];
    }

    [[nodiscard]] boost::iterator_range<const int*> constIntRange() const{
        return { constDataInt(), constDataInt() + _numElements * _componentCount };
    }

    boost::iterator_range<int*> intRange(){
        return { dataInt(), dataInt() + _numElements * _componentCount };
    }

    [[nodiscard]] double getDouble(std::size_t idx) const{
        assert(idx < _numElements);
        return constDataDouble()[idx];
    }

    [[nodiscard]] const Point3& getPoint3(std::size_t idx) const{
        // assert(idx < _numElements);
        return constDataPoint3()[idx];
    }

    void setInt(std::size_t idx, int v){
        assert(idx < _numElements);
        dataInt()[idx] = v;
    }

    void setDouble(std::size_t idx, double v){
        assert(idx < _numElements);
        dataDouble()[idx] = v;
    }

    void setPoint3(std::size_t idx, const Point3& p){
        assert(idx < _numElements);
        dataPoint3()[idx] = p;
    }

    int getIntComponent(std::size_t index, std::size_t componentIndex) const{
        assert(index < _numElements && componentIndex < _componentCount);
        return constDataInt()[index * _componentCount + componentIndex];
    }
    
    double getDoubleComponent(std::size_t index, std::size_t componentIndex) const{
        assert(index < _numElements && componentIndex < _componentCount);
        return constDataDouble()[index * _componentCount + componentIndex];
    }

    void setIntComponent(std::size_t index, std::size_t componentIndex, int newValue){
        assert(index < _numElements && componentIndex < _componentCount);
        dataInt()[index * _componentCount + componentIndex] = newValue;
    }

    void setDoubleComponent(std::size_t index, std::size_t componentIndex, double newValue){
        assert(index < _numElements && componentIndex < _componentCount);
        dataDouble()[index * _componentCount + componentIndex] = newValue;
    }

    void resize(std::size_t newSize, bool preserveData);

protected:
    DataType _dataType = DataType::Void;
    std::size_t _dataTypeSize = 0;
    std::size_t _numElements = 0;
    std::size_t _stride = 0;
    std::size_t _componentCount = 0;
    std::unique_ptr<std::uint8_t[]> _data;
};

}