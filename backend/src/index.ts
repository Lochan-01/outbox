import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { config } from './config';
import { emailQueue } from './queue/emailQueue';
import { startEmailWorker } from './queue/emailWorker';
import { reconcileJobsOnBoot } from './queue/reconcile';
import { initEtherealSMTP } from './services/etherealService';
import { initElasticsearch } from './services/elasticsearchService';

import emailRoutes from './routes/emailRoutes';
import slackRoutes from './routes/slackRoutes';
import searchRoutes from './routes/searchRoutes';
import queueRoutes from './routes/queueRoutes';

async function bootstrap() {
  const app = express();

  // Middleware
  app.use(cors({ origin: '*' }));
  app.use(express.json());

  // 1. Initialize Bull Board Dashboard
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue) as any],
    serverAdapter: serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());

  // 2. Mount API Routes
  app.use('/api/emails/search', searchRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/slack', slackRoutes);
  app.use('/api/queue', queueRoutes);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 3. Initialize Services
  console.log('⚡ Initializing Email Scheduler Backend Services...');
  await initEtherealSMTP();
  await initElasticsearch();

  // 4. Start BullMQ Worker
  startEmailWorker();

  // 5. Run Boot Reconciliation for restart recovery & idempotency
  await reconcileJobsOnBoot();

  // 6. Start HTTP Server
  app.listen(config.port, () => {
    console.log(`====================================================`);
    console.log(`🚀 Backend Server running on http://localhost:${config.port}`);
    console.log(`📊 Bull Board Dashboard: http://localhost:${config.port}/admin/queues`);
    console.log(`====================================================`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error during backend server startup:', err);
  process.exit(1);
});
