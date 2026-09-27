import { emailQueue } from './emailQueue';
import { prisma } from '../db/prisma';
import { indexEmailJob } from '../services/elasticsearchService';

export async function reconcileJobsOnBoot(): Promise<void> {
  try {
    console.log('🔄 Running Boot Reconciliation for Scheduled Email Jobs...');

    // Find all emails that are supposed to be sent in the future or currently pending
    const pendingJobs = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SCHEDULED', 'RESCHEDULED'] },
      },
    });

    console.log(`📋 Found ${pendingJobs.length} scheduled/rescheduled job(s) in Postgres database.`);

    let reconciledCount = 0;

    for (const job of pendingJobs) {
      // Index in ES to ensure synchronization
      await indexEmailJob(job);

      // Check if job exists in BullMQ queue
      const existingBullJob = await emailQueue.getJob(job.idempotencyKey);

      if (!existingBullJob) {
        const now = Date.now();
        const scheduledTime = new Date(job.scheduledAt).getTime();
        const delay = Math.max(0, scheduledTime - now);

        await emailQueue.add(
          'send-email',
          {
            jobId: job.id,
            userId: job.userId,
            senderEmail: job.senderEmail,
            recipientEmail: job.recipientEmail,
            subject: job.subject,
            body: job.body,
            scheduledAt: job.scheduledAt.toISOString(),
            delayBetweenSendsMs: job.delayBetweenSendsMs,
            hourlyLimit: job.hourlyLimit,
            idempotencyKey: job.idempotencyKey,
          },
          {
            jobId: job.idempotencyKey,
            delay,
          }
        );

        reconciledCount++;
        console.log(`🔁 Reconciled missing job ${job.id} for ${job.recipientEmail} with delay = ${delay}ms`);
      }
    }

    console.log(`✅ Boot Reconciliation completed. Re-enqueued ${reconciledCount} missing job(s).`);
  } catch (error: any) {
    console.error('⚠️ Error during boot reconciliation:', error.message);
  }
}
