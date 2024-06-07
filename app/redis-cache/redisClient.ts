// redisClient.ts
import { createClient } from 'redis';

const client = createClient({
  url: 'redis://redis-auto.redis.cache.windows.net:6379',
  password: 'TU_CLAVE_PRINCIPAL',  
});

client.on('error', (err) => console.error('Redis Client Error', err));

(async () => {
  try {
    await client.connect();
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
})();

export default client;
