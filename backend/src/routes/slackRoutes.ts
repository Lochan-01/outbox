import { Router, Request, Response } from 'express';
import { getSlackAuthUrl, handleSlackOAuthCallback } from '../services/slackService';
import { prisma } from '../db/prisma';
import { config } from '../config';

const router = Router();

// Redirect user to Slack OAuth page
router.get('/auth', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || '';
  const url = getSlackAuthUrl(userId);
  return res.redirect(url);
});

// Slack OAuth Callback Handler
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).send('Missing authorization code from Slack.');
    }

    const userId = typeof state === 'string' ? state : undefined;
    const result = await handleSlackOAuthCallback(code, userId);

    console.log('✅ Slack OAuth connected successfully:', result);

    return res.redirect(`${config.frontendUrl}?slackConnected=true`);
  } catch (error: any) {
    console.error('Slack Callback Error:', error.message);
    return res.redirect(`${config.frontendUrl}?slackError=${encodeURIComponent(error.message)}`);
  }
});

// Direct Webhook update endpoint (useful for local dev testing)
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { userId, userEmail, webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'webhookUrl is required.' });
    }

    let user;
    if (userId) {
      user = await prisma.user.update({
        where: { id: userId },
        data: { slackWebhookUrl: webhookUrl },
      });
    } else if (userEmail) {
      user = await prisma.user.upsert({
        where: { email: userEmail },
        update: { slackWebhookUrl: webhookUrl },
        create: { email: userEmail, slackWebhookUrl: webhookUrl },
      });
    } else {
      // Find or create default fallback user
      user = await prisma.user.upsert({
        where: { email: 'admin@system.local' },
        update: { slackWebhookUrl: webhookUrl },
        create: { email: 'admin@system.local', name: 'System Admin', slackWebhookUrl: webhookUrl },
      });
    }

    return res.json({ message: 'Slack webhook connected successfully', user });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Check Slack status for a user
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { userId, userEmail } = req.query;
    let user = null;

    if (userId && typeof userId === 'string') {
      user = await prisma.user.findUnique({ where: { id: userId } });
    } else if (userEmail && typeof userEmail === 'string') {
      user = await prisma.user.findUnique({ where: { email: userEmail } });
    } else {
      user = await prisma.user.findFirst({
        where: { OR: [{ slackWebhookUrl: { not: null } }, { slackAccessToken: { not: null } }] },
      });
    }

    const isConnected = !!(user?.slackWebhookUrl || user?.slackAccessToken);
    return res.json({
      connected: isConnected,
      userEmail: user?.email || null,
      hasWebhook: !!user?.slackWebhookUrl,
      hasToken: !!user?.slackAccessToken,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
