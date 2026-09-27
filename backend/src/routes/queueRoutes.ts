import { Router, Request, Response } from 'express';
import { emailQueue } from '../queue/emailQueue';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [waiting, active, delayed, completed, failed] = await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getActiveCount(),
      emailQueue.getDelayedCount(),
      emailQueue.getCompletedCount(),
      emailQueue.getFailedCount(),
    ]);

    return res.json({
      waiting,
      active,
      delayed,
      completed,
      failed,
      total: waiting + active + delayed + completed + failed,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
