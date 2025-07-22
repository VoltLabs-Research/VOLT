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
    Float = 6
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

    [[nodiscard]] std::size_t componentCount() const noexcept{
        return _componentCount;
    }

    [[nodiscard]] const void* constData() const noexcept{
        return _data.get();
    }

    [[nodiscard]] const int* constDataInt() const noexcept{
        return reinterpret_cast<const int*>(constData());
    }

    [[nodiscard]] const double* constDataFloat() const noexcept{
        return reinterpret_cast<const double*>(constData());
    }

    [[nodiscard]] const Point3* constDataPoint3() const noexcept{
        return reinterpret_cast<const Point3*>(constData());
    }

    [[nodiscard]] const Point3I* constDataPoint3I() const noexcept{
        return reinterpret_cast<const Point3I*>(constData());
    }

    [[nodiscard]] const SymmetricTensor2* constDataSymmetricTensor2() const noexcept{
        return reinterpret_cast<const SymmetricTensor2*>(constData());
    }

    [[nodiscard]] const Matrix3* constDataMatrix3() const noexcept{
        return reinterpret_cast<const Matrix3*>(constData());
    }

    [[nodiscard]] const Quaternion* constDataQuaternion() const noexcept{
        return reinterpret_cast<const Quaternion*>(constData());
    }

    [[nodiscard]] boost::iterator_range<const int*> constIntRange() const{
        return { constDataInt(), constDataInt() + _numElements };
    }

    [[nodiscard]] boost::iterator_range<const double*> constFloatRange() const{
        return { constDataFloat(), constDataFloat() + _numElements };
    }

    [[nodiscard]] boost::iterator_range<const Point3*> constPoint3Range() const{
        return { constDataPoint3(), constDataPoint3() + _numElements };
    }

    [[nodiscard]] boost::iterator_range<const SymmetricTensor2*> constSymmetricTensor2Range() const{
        return { constDataSymmetricTensor2(), constDataSymmetricTensor2() + _numElements };
    }

    [[nodiscard]] boost::iterator_range<const Matrix3*> constMatrix3Range() const{
        return { constDataMatrix3(), constDataMatrix3() + _numElements };
    }

    [[nodiscard]] boost::iterator_range<const Quaternion*> constQuaternionRange() const{
        return { constDataQuaternion(), constDataQuaternion() + _numElements };
    }

    void* data() noexcept{
        return _data.get();
    }

    int* dataInt() noexcept{
        return reinterpret_cast<int*>(data());
    }

    double* dataFloat() noexcept{
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

    boost::iterator_range<int*> intRange(){
        assert(_componentCount == 1);
        return { dataInt(), dataInt() + _numElements };
    }

    boost::iterator_range<double*> floatRange(){
        assert(_componentCount == 1);
        return { dataFloat(), dataFloat() + _numElements };
    }

    boost::iterator_range<Point3*> point3Range(){
        return { dataPoint3(), dataPoint3() + _numElements };
    }

    boost::iterator_range<SymmetricTensor2*> symmetricTensor2Range(){
        return { dataSymmetricTensor2(), dataSymmetricTensor2() + _numElements };
    }

    boost::iterator_range<Matrix3*> matrix3Range(){
        return { dataMatrix3(), dataMatrix3() + _numElements };
    }

    boost::iterator_range<Quaternion*> quaternionRange(){
        return { dataQuaternion(), dataQuaternion() + _numElements };
    }

    [[nodiscard]] int getInt(std::size_t idx) const{
        assert(idx < _numElements);
        return constDataInt()[idx];
    }

    [[nodiscard]] double getFloat(std::size_t idx) const{
        assert(idx < _numElements);
        return constDataFloat()[idx];
    }

    [[nodiscard]] const Point3& getPoint3(std::size_t idx) const{
        assert(idx < _numElements);
        return constDataPoint3()[idx];
    }

    void setInt(std::size_t idx, int v){
        assert(idx < _numElements);
        dataInt()[idx] = v;
    }

    void setFloat(std::size_t idx, double v){
        assert(idx < _numElements);
        dataFloat()[idx] = v;
    }

    void setPoint3(std::size_t idx, const Point3& p){
        assert(idx < _numElements);
        dataPoint3()[idx] = p;
    }

    int getIntComponent(std::size_t index, std::size_t componentIndex) const{
        assert(index < _numElements && componentIndex < _componentCount);
        return constDataInt()[index * _componentCount + componentIndex];
    }
    
    double getFloatComponent(std::size_t index, std::size_t componentIndex) const{
        assert(index < _numElements && componentIndex < _componentCount);
        return constDataFloat()[index * _componentCount + componentIndex];
    }

    void setIntComponent(std::size_t index, std::size_t componentIndex, int newValue){
        assert(index < _numElements && componentIndex < _componentCount);
        dataInt()[index * _componentCount + componentIndex] = newValue;
    }

    void setFloatComponent(std::size_t index, std::size_t componentIndex, double newValue){
        assert(index < _numElements && componentIndex < _componentCount);
        dataFloat()[index * _componentCount + componentIndex] = newValue;
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