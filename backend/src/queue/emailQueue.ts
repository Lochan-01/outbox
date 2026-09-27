import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';

export const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null,
});

redisConnection.on('error', (err) => {
  console.warn(`⚠️ Redis Connection Warning/Error: ${err.message}`);
});

export const EMAIL_QUEUE_NAME = 'email-scheduler-queue';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});
