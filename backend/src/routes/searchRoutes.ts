import { Router, Request, Response } from 'express';
import { searchEmailJobs } from '../services/elasticsearchService';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { q, status, startDate, endDate, limit, offset } = req.query;

    const results = await searchEmailJobs({
      q: typeof q === 'string' ? q : undefined,
      status: typeof status === 'string' ? status : undefined,
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });

    return res.json(results);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
