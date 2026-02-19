const cacheStore = {};

export function setCache(key, value){
  cacheStore[key] = {
    value,
    timestamp: Date.now()
  };
}

export function getCache(key, ttl = 60000){ // default 1 menit

  const item = cacheStore[key];

  if (!item) return null;

  const isExpired = (Date.now() - item.timestamp) > ttl;

  if (isExpired){
    delete cacheStore[key];
    return null;
  }

  return item.value;
}

export function clearCache(key){
  delete cacheStore[key];
}
