import axios from 'axios';
import { prisma } from '../db/prisma';
import { config } from '../config';

export function getSlackAuthUrl(state?: string): string {
  const scope = 'chat:write,incoming-webhook';
  const url = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(
    config.slack.clientId
  )}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(
    config.slack.redirectUri
  )}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
  return url;
}

export async function handleSlackOAuthCallback(code: string, userId?: string) {
  try {
    const response = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        code,
        redirect_uri: config.slack.redirectUri,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (!response.data.ok) {
      throw new Error(`Slack OAuth Error: ${response.data.error}`);
    }

    const accessToken = response.data.access_token;
    const webhookUrl = response.data.incoming_webhook?.url;
    const teamId = response.data.team?.id;

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          slackAccessToken: accessToken,
          slackWebhookUrl: webhookUrl,
          slackTeamId: teamId,
        },
      });
    }

    return { accessToken, webhookUrl, teamId };
  } catch (error: any) {
    console.error('Slack OAuth Callback Failed:', error.message);
    throw error;
  }
}

export async function sendSlackRateLimitNotification(params: {
  userId?: string | null;
  senderEmail: string;
  limit: number;
  rescheduledCount: number;
  nextAvailableTime: Date;
}) {
  try {
    let webhookUrl: string | null = null;
    let accessToken: string | null = null;

    if (params.userId) {
      const user = await prisma.user.findUnique({
        where: { id: params.userId },
      });
      if (user) {
        webhookUrl = user.slackWebhookUrl;
        accessToken = user.slackAccessToken;
      }
    }

    if (!webhookUrl && !accessToken) {
      // Check if any user in DB has slack connected as a fallback/global team webhook
      const userWithSlack = await prisma.user.findFirst({
        where: { OR: [{ slackWebhookUrl: { not: null } }, { slackAccessToken: { not: null } }] },
      });
      if (userWithSlack) {
        webhookUrl = userWithSlack.slackWebhookUrl;
        accessToken = userWithSlack.slackAccessToken;
      }
    }

    if (!webhookUrl && !accessToken) {
      console.log(`ℹ️ Slack notification skipped: User has not connected Slack yet.`);
      return;
    }

    const messageText = `⚠️ *Email Scheduler Rate Limit Alert*\n*Sender:* \`${
      params.senderEmail
    }\` hit hourly limit of *${params.limit} emails/hr*.\n*Action:* ${
      params.rescheduledCount
    } email(s) rescheduled to next hour window at *${params.nextAvailableTime.toLocaleTimeString()}*.`;

    if (webhookUrl) {
      await axios.post(webhookUrl, { text: messageText });
      console.log(`💬 Sent Slack alert via webhook for ${params.senderEmail}`);
    } else if (accessToken) {
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel: 'general',
          text: messageText,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(`💬 Sent Slack alert via API for ${params.senderEmail}`);
    }
  } catch (error: any) {
    console.error(`⚠️ Slack Notification Error: ${error.message}`);
    // Per constraint: skip gracefully without crashing
  }
}
