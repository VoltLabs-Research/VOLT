#ifndef __DXA_MEMORY_POOL_H
#define __DXA_MEMORY_POOL_H

#include <opendxa/includes.hpp>
#include <memory>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <mutex>
#include <atomic>
#include <stdexcept>
#include <type_traits>

template<typename T>
class MemoryPool {
public:
    static_assert(std::is_destructible<T>::value, "T must be destructible");
    
    explicit MemoryPool(size_t pageSize = 1024) 
        : pageSize_(validatePageSize(pageSize))
        , currentOffset_(pageSize_)
        , totalAllocated_(0)
        , totalConstructed_(0)
        , isClearing_(false)
    {
        static_assert(sizeof(T) > 0, "Cannot instantiate pool for incomplete type");
    }
    
    ~MemoryPool() noexcept {
        try {
            clear();
        } catch (...) {
            emergencyClear();
        }
    }

    MemoryPool(const MemoryPool&) = delete;
    MemoryPool& operator=(const MemoryPool&) = delete;
    MemoryPool(MemoryPool&&) = delete;
    MemoryPool& operator=(MemoryPool&&) = delete;

    template<typename... Args>
    T* construct(Args&&... args) {
        std::lock_guard<std::mutex> lock(mutex_);
        
        if (isClearing_) {
            throw std::runtime_error("Cannot construct objects while pool is being cleared");
        }

        T* ptr = nullptr;
        try {
            ptr = allocate();
            
            new (ptr) T(std::forward<Args>(args)...);
            
            ObjectInfo info{getCurrentPageIndex(), getCurrentOffsetInPage(ptr)};
            constructedObjects_[ptr] = info;
            ++totalConstructed_;
            
            return ptr;
        } catch (...) {
            throw;
        }
    }

    bool destroy(T* ptr) {
        if (!ptr) return false;
        
        std::lock_guard<std::mutex> lock(mutex_);
        
        if (isClearing_) {
            return false;
        }

        auto it = constructedObjects_.find(ptr);
        if (it == constructedObjects_.end()) {
            return false; 
        }

        try {
            ptr->~T();
            constructedObjects_.erase(it);
            --totalConstructed_;
            return true;
        } catch (...) {
            constructedObjects_.erase(it);
            --totalConstructed_;
            throw;
        }
    }

    void clear(){
        std::lock_guard<std::mutex> lock(mutex_);
        
        isClearing_ = true;
        
        try {
            clearConstructedObjects();
            clearPages();
            resetState();
        } catch (...) {
            try {
                resetState();
            } catch (...) {
            }
            throw;
        }
        
        isClearing_ = false;
    }

    size_t memoryUsage() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return pages_.size() * pageSize_ * sizeof(T);
    }

    size_t totalAllocated() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return totalAllocated_.load();
    }

    size_t constructedCount() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return totalConstructed_.load();
    }

    size_t pageCount() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return pages_.size();
    }

    size_t pageSize() const noexcept {
        return pageSize_;
    }

    bool empty() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return totalConstructed_.load() == 0;
    }

    bool validate() const {
        std::lock_guard<std::mutex> lock(mutex_);
        
        try {
            for (const auto& pair : constructedObjects_) {
                T* ptr = pair.first;
                const ObjectInfo& info = pair.second;
                
                if (info.pageIndex >= pages_.size()) {
                    return false;
                }
                
                unsigned char* pageStart = pages_[info.pageIndex];
                unsigned char* expectedPtr = pageStart + info.offsetInPage * sizeof(T);
                
                if (reinterpret_cast<unsigned char*>(ptr) != expectedPtr) {
                    return false;
                }
            }
            
            return true;
        } catch (...) {
            return false;
        }
    }

    // Reserves space for at least n **unbuilt** objects.
    // If there is already enough capacity, do nothing.
    void reserve(std::size_t n){
        std::lock_guard<std::mutex> lock(mutex_);
        // it's enough
        if(n <= capacity()) return;
        // Maximum number of objects per page
        const std::size_t objsPerPage = pageSize_;
        // Total pages that would be needed
        std::size_t pagesNeeded = (n + objsPerPage - 1) / objsPerPage;
        // Add missing pages
        while(pages_.size() < pagesNeeded){
            try{
                unsigned char* newPage = new unsigned char[pageSize_ * sizeof(T)];
                pages_.push_back(newPage);
            }catch(const std::bad_alloc&){
                throw std::runtime_error("MemoryPool::reserve out of memory.");
            }
        }
    }

    // Current total capacity (possible objects before reallocating).
    std::size_t capacity() const noexcept{
        // Each page has pageSize_ "holes" of size sizeof(T)
        return pages_.size() * pageSize;
    }

private:
    struct ObjectInfo {
        size_t pageIndex;
        size_t offsetInPage;
    };

    static size_t validatePageSize(size_t pageSize) {
        if (pageSize == 0) {
            throw std::invalid_argument("Page size cannot be zero");
        }
        if (pageSize > SIZE_MAX / sizeof(T)) {
            throw std::invalid_argument("Page size too large, would cause overflow");
        }
        return pageSize;
    }

    T* allocate() {
        if (currentOffset_ >= pageSize_) {
            allocateNewPage();
        }

        unsigned char* page = pages_.back();
        T* ptr = reinterpret_cast<T*>(page + currentOffset_ * sizeof(T));
        ++currentOffset_;
        ++totalAllocated_;
        
        return ptr;
    }

    void allocateNewPage() {
        try {
            unsigned char* newPage = new unsigned char[pageSize_ * sizeof(T)];
            pages_.push_back(newPage);
            currentOffset_ = 0;
        } catch (const std::bad_alloc&) {
            throw std::runtime_error("Failed to allocate new page: out of memory");
        }
    }

    size_t getCurrentPageIndex() const {
        return pages_.empty() ? 0 : pages_.size() - 1;
    }

    size_t getCurrentOffsetInPage(T* ptr) const {
        if (pages_.empty()) return 0;
        
        unsigned char* pageStart = pages_.back();
        unsigned char* ptrBytes = reinterpret_cast<unsigned char*>(ptr);
        
        return (ptrBytes - pageStart) / sizeof(T);
    }

    void clearConstructedObjects() {
        std::vector<std::exception_ptr> exceptions;
        
        for (auto it = constructedObjects_.begin(); it != constructedObjects_.end(); ++it) {
            try {
                it->first->~T();
            } catch (...) {
                exceptions.push_back(std::current_exception());
            }
        }
        
        constructedObjects_.clear();
        totalConstructed_ = 0;
        
        if (!exceptions.empty()) {
            std::rethrow_exception(exceptions.front());
        }
    }

    void clearPages() {
        for (unsigned char* page : pages_) {
            delete[] page;
        }
        pages_.clear();
    }

    void resetState() noexcept {
        currentOffset_ = pageSize_;
        totalAllocated_ = 0;
        totalConstructed_ = 0;
    }

    void emergencyClear() noexcept {
        try {
            for (unsigned char* page : pages_) {
                delete[] page;
            }
            pages_.clear();
            constructedObjects_.clear();
            resetState();
        } catch (...) {
        }
    }

    const size_t pageSize_;
    std::vector<unsigned char*> pages_;
    std::unordered_map<T*, ObjectInfo> constructedObjects_;
    
    size_t currentOffset_;
    std::atomic<size_t> totalAllocated_;
    std::atomic<size_t> totalConstructed_;
    
    std::atomic<bool> isClearing_;
    mutable std::mutex mutex_; 
};

#endif