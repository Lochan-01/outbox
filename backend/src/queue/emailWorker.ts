import { Worker, Job } from 'bullmq';
import { redisConnection, EMAIL_QUEUE_NAME, emailQueue } from './emailQueue';
import { prisma } from '../db/prisma';
import { sendMail } from '../services/etherealService';
import { indexEmailJob } from '../services/elasticsearchService';
import { sendSlackRateLimitNotification } from '../services/slackService';
import { config } from '../config';

export interface EmailJobData {
  jobId: string; // Database EmailJob UUID
  userId?: string | null;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  delayBetweenSendsMs: number;
  hourlyLimit: number;
  idempotencyKey: string;
}

function getHourKey(date: Date, senderEmail: string): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  return `rate_limit:${senderEmail}:${yyyy}-${mm}-${dd}-${hh}`;
}

function getStartOfNextHour(date: Date): Date {
  const next = new Date(date);
  next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0);
  return next;
}

async function checkAndIncrementRateLimit(senderEmail: string, maxLimit: number): Promise<{ allowed: boolean; count: number }> {
  const key = getHourKey(new Date(), senderEmail);
  const count = await redisConnection.incr(key);

  if (count === 1) {
    // Set 2 hour TTL to ensure clean expiration
    await redisConnection.expire(key, 7200);
  }

  if (count > maxLimit) {
    return { allowed: false, count };
  }

  return { allowed: true, count };
}

export function startEmailWorker() {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const data = job.data;
      console.log(`⚙️ Worker processing job ${job.id} (DB ID: ${data.jobId}) for ${data.recipientEmail}`);

      // 1. Fetch job from DB to enforce Idempotency & Persistence
      const dbJob = await prisma.emailJob.findUnique({
        where: { id: data.jobId },
      });

      if (!dbJob) {
        console.warn(`⚠️ Job ${data.jobId} not found in DB. Skipping.`);
        return;
      }

      if (dbJob.status === 'SENT') {
        console.log(`✅ Job ${data.jobId} already sent. Idempotency guard triggered.`);
        return;
      }

      // 2. Enforce Hourly Rate Limit per sender
      const effectiveLimit = Math.min(
        data.hourlyLimit || config.maxEmailsPerHourPerSender,
        config.maxEmailsPerHour
      );

      const rateCheck = await checkAndIncrementRateLimit(data.senderEmail, effectiveLimit);

      if (!rateCheck.allowed) {
        const now = new Date();
        const nextHourStart = getStartOfNextHour(now);

        // Add small jitter based on last digit of timestamp/id to preserve relative ordering
        const delayMs = Math.max(1000, nextHourStart.getTime() - now.getTime() + (job.id ? parseInt(job.id.slice(-3), 16) % 3000 : 0));

        console.warn(
          `🚫 Sender ${data.senderEmail} exceeded hourly limit (${effectiveLimit}/hr). Rescheduling job ${data.jobId} to ${nextHourStart.toISOString()} (delay: ${delayMs}ms)`
        );

        // Update DB status to RESCHEDULED
        const updatedDbJob = await prisma.emailJob.update({
          where: { id: data.jobId },
          data: {
            status: 'RESCHEDULED',
            scheduledAt: nextHourStart,
            attempts: { increment: 1 },
          },
        });

        // Re-enqueue in BullMQ for next hour window
        await emailQueue.add(
          'send-email',
          {
            ...data,
            scheduledAt: nextHourStart.toISOString(),
          },
          {
            jobId: `${data.idempotencyKey}_rescheduled_${Date.now()}`,
            delay: delayMs,
          }
        );

        // Sync ES index
        await indexEmailJob(updatedDbJob);

        // Send Slack alert
        await sendSlackRateLimitNotification({
          userId: data.userId,
          senderEmail: data.senderEmail,
          limit: effectiveLimit,
          rescheduledCount: 1,
          nextAvailableTime: nextHourStart,
        });

        return;
      }

      // 3. Mark DB as PROCESSING
      await prisma.emailJob.update({
        where: { id: data.jobId },
        data: { status: 'PROCESSING' },
      });

      // 4. Enforce per-send delay
      const sendDelay = Math.max(data.delayBetweenSendsMs || 0, config.minDelayBetweenSendsMs);
      if (sendDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, sendDelay));
      }

      // 5. Send via Ethereal SMTP
      try {
        const sendResult = await sendMail({
          from: data.senderEmail,
          to: data.recipientEmail,
          subject: data.subject,
          html: data.body,
        });

        const sentJob = await prisma.emailJob.update({
          where: { id: data.jobId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            previewUrl: sendResult.previewUrl || null,
            bullJobId: job.id,
            errorReason: null,
          },
        });

        console.log(`🎉 Successfully sent email to ${data.recipientEmail}. MessageId: ${sendResult.messageId}`);

        // 6. Index in Elasticsearch
        await indexEmailJob(sentJob);
      } catch (error: any) {
        console.error(`❌ Failed to send email to ${data.recipientEmail}: ${error.message}`);
        const failedJob = await prisma.emailJob.update({
          where: { id: data.jobId },
          data: {
            status: 'FAILED',
            errorReason: error.message,
            attempts: { increment: 1 },
          },
        });

        await indexEmailJob(failedJob);
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: config.workerConcurrency,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`💥 BullMQ Job ${job?.id} failed:`, err);
  });

  console.log(`🚀 BullMQ Email Worker started with concurrency = ${config.workerConcurrency}`);
  return worker;
}
