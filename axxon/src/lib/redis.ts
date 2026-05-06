// lib/redis.ts
import Redis from "ioredis";
import { getRedisUrl } from './env/connectionConfig';

const redis = new Redis(getRedisUrl());

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export default redis;
