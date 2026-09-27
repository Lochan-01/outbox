import { Client } from '@elastic/elasticsearch';
import { config } from '../config';
import { prisma } from '../db/prisma';

export const esClient = new Client({
  node: config.elasticsearch.node,
});

const INDEX_NAME = 'email_jobs';

export async function initElasticsearch(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: INDEX_NAME });
    if (!exists) {
      await esClient.indices.create({
        index: INDEX_NAME,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderEmail: { type: 'keyword' },
            recipientEmail: { type: 'keyword' },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' },
          },
        },
      });
      console.log(`🔍 Elasticsearch index '${INDEX_NAME}' created successfully.`);
    } else {
      console.log(`🔍 Elasticsearch index '${INDEX_NAME}' already exists.`);
    }
  } catch (error: any) {
    console.warn(`⚠️ Elasticsearch initialization failed (may be offline): ${error.message}`);
  }
}

export async function indexEmailJob(document: Record<string, any>): Promise<void> {
  try {
    await esClient.index({
      index: INDEX_NAME,
      id: document.id,
      document: {
        id: document.id,
        userId: document.userId,
        senderEmail: document.senderEmail,
        recipientEmail: document.recipientEmail,
        subject: document.subject,
        body: document.body,
        status: document.status,
        scheduledAt: document.scheduledAt ? new Date(document.scheduledAt).toISOString() : null,
        sentAt: document.sentAt ? new Date(document.sentAt).toISOString() : null,
        createdAt: document.createdAt ? new Date(document.createdAt).toISOString() : null,
      },
    });
  } catch (error: any) {
    console.warn(`⚠️ Failed to index email job ${document.id} in Elasticsearch: ${error.message}`);
  }
}

export async function searchEmailJobs(params: {
  q?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const must: any[] = [];

    if (params.q) {
      must.push({
        multi_match: {
          query: params.q,
          fields: ['subject', 'recipientEmail', 'senderEmail', 'body'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (params.status) {
      must.push({
        term: { status: params.status },
      });
    }

    if (params.startDate || params.endDate) {
      const range: any = {};
      if (params.startDate) range.gte = params.startDate;
      if (params.endDate) range.lte = params.endDate;
      must.push({
        range: { scheduledAt: range },
      });
    }

    const query = must.length > 0 ? { bool: { must } } : { match_all: {} };

    const result = await esClient.search({
      index: INDEX_NAME,
      query,
      from: params.offset || 0,
      size: params.limit || 50,
      sort: [{ scheduledAt: { order: 'desc' } }],
    });

    const hits = result.hits.hits.map((hit: any) => hit._source);
    const total = typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value || 0;

    if (total === 0 && params.q) {
      // DB Fallback search
      const dbJobs = await prisma.emailJob.findMany({
        where: {
          OR: [
            { subject: { contains: params.q, mode: 'insensitive' } },
            { recipientEmail: { contains: params.q, mode: 'insensitive' } },
            { senderEmail: { contains: params.q, mode: 'insensitive' } },
            { body: { contains: params.q, mode: 'insensitive' } },
          ],
        },
        orderBy: { scheduledAt: 'desc' },
      });
      return { hits: dbJobs, total: dbJobs.length };
    }

    return { hits, total };
  } catch (error: any) {
    console.warn(`⚠️ Elasticsearch search failed: ${error.message}. Falling back to DB search.`);
    const where: any = {};
    if (params.q) {
      where.OR = [
        { subject: { contains: params.q, mode: 'insensitive' } },
        { recipientEmail: { contains: params.q, mode: 'insensitive' } },
        { senderEmail: { contains: params.q, mode: 'insensitive' } },
        { body: { contains: params.q, mode: 'insensitive' } },
      ];
    }
    const dbJobs = await prisma.emailJob.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
    });
    return { hits: dbJobs, total: dbJobs.length };
  }
}
