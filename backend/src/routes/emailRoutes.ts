import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/prisma';
import { emailQueue } from '../queue/emailQueue';
import { indexEmailJob } from '../services/elasticsearchService';

const router = Router();

// Schedule single or batch of emails
router.post('/schedule', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      senderEmail,
      recipients, // string array or single string
      subject,
      body,
      scheduledAt, // ISO date string or timestamp
      delayBetweenSendsMs = 500,
      hourlyLimit = 20,
    } = req.body;

    if (!senderEmail || !recipients || !subject || !body) {
      return res.status(400).json({
        error: 'Missing required fields: senderEmail, recipients, subject, body',
      });
    }

    const recipientList: string[] = Array.isArray(recipients)
      ? recipients.map((r: string) => r.trim()).filter(Boolean)
      : [recipients.trim()];

    if (recipientList.length === 0) {
      return res.status(400).json({ error: 'No valid recipient email addresses provided.' });
    }

    const targetDate = scheduledAt ? new Date(scheduledAt) : new Date();
    const now = Date.now();
    const baseDelay = Math.max(0, targetDate.getTime() - now);

    const createdJobs: any[] = [];

    // Process each recipient in transaction / batch
    for (let i = 0; i < recipientList.length; i++) {
      const recipient = recipientList[i];

      // Calculate staggered delay for batch items if delayBetweenSendsMs > 0
      const staggeredDelay = baseDelay + i * (delayBetweenSendsMs || 500);
      const staggeredScheduledAt = new Date(now + staggeredDelay);
      const idempotencyKey = `job_${uuidv4()}_${Date.now()}_${i}`;

      // 1. Save in Postgres DB first
      const dbJob = await prisma.emailJob.create({
        data: {
          userId: userId || null,
          senderEmail,
          recipientEmail: recipient,
          subject,
          body,
          status: 'SCHEDULED',
          scheduledAt: staggeredScheduledAt,
          delayBetweenSendsMs,
          hourlyLimit,
          idempotencyKey,
        },
      });

      // 2. Add to BullMQ delayed queue
      const bullJob = await emailQueue.add(
        'send-email',
        {
          jobId: dbJob.id,
          userId: dbJob.userId,
          senderEmail: dbJob.senderEmail,
          recipientEmail: dbJob.recipientEmail,
          subject: dbJob.subject,
          body: dbJob.body,
          scheduledAt: dbJob.scheduledAt.toISOString(),
          delayBetweenSendsMs: dbJob.delayBetweenSendsMs,
          hourlyLimit: dbJob.hourlyLimit,
          idempotencyKey: dbJob.idempotencyKey,
        },
        {
          jobId: dbJob.idempotencyKey,
          delay: staggeredDelay,
        }
      );

      // Update bullJobId in DB
      const updatedJob = await prisma.emailJob.update({
        where: { id: dbJob.id },
        data: { bullJobId: bullJob.id },
      });

      // 3. Index in Elasticsearch
      await indexEmailJob(updatedJob);

      createdJobs.push(updatedJob);
    }

    return res.status(201).json({
      message: `Successfully scheduled ${createdJobs.length} email job(s).`,
      jobs: createdJobs,
    });
  } catch (error: any) {
    console.error('Error scheduling emails:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET list of email jobs from DB
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (status && typeof status === 'string') {
      where.status = status;
    }

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.emailJob.count({ where }),
    ]);

    return res.json({ jobs, total });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET single email job detail
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const job = await prisma.emailJob.findUnique({
      where: { id: req.params.id },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json(job);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Cancel a scheduled job
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const job = await prisma.emailJob.findUnique({
      where: { id: req.params.id },
    });

    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (job.status === 'SENT' || job.status === 'PROCESSING') {
      return res.status(400).json({ error: `Cannot cancel job in state ${job.status}` });
    }

    if (job.idempotencyKey) {
      const bullJob = await emailQueue.getJob(job.idempotencyKey);
      if (bullJob) {
        await bullJob.remove();
      }
    }

    const deleted = await prisma.emailJob.delete({
      where: { id: req.params.id },
    });

    return res.json({ message: 'Job cancelled successfully', job: deleted });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
