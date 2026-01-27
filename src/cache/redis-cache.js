const cache = new Map();
const DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds

const setCache = (key, data, ttl = DEFAULT_TTL) => {
    cache.set(key, {
        data,
        expiry: Date.now() + ttl
    });
}

const getCache = (key) => {
    const cached = cache.get(key);
    if(!cached || Date.now() > cached.expiry) {
        cache.delete(key);
        console.log(`[CACHE MISS] ${key}`);
        return null;
    }
    console.log(`[CACHE HIT] ${key}`);
    return cached.data;
}

const clearCache = (key) => {
    cache.delete(key);
}

const clearAllCache = () => {
    cache.clear();
}

module.exports = {
    setCache,
    getCache,
    clearCache,
    clearAllCache,
}