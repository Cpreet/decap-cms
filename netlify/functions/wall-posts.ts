import { getStore } from '@netlify/blobs';

const ISSUE_LABELS: Record<string, string> = {
  deposit: 'Deposit Withholding',
  eviction: 'Illegal Eviction',
  harassment: 'Landlord Harassment',
  hike: 'Arbitrary Rent Hike',
  discrimination: 'Discrimination',
  rwa: 'RWA Discrimination',
  other: 'Other Violation',
};

const MAX_CITY = 80;
const MAX_BODY = 1000;

type WallPost = {
  id: string;
  location: string;
  issue_type: string;
  body: string;
  upvotes: number;
  created_at: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export default async (req: Request) => {
  const store = getStore('wall-posts');

  if (req.method === 'GET') {
    const { blobs } = await store.list();
    const posts = await Promise.all(
      blobs.map((b) => store.get(b.key, { type: 'json' }) as Promise<WallPost>)
    );
    const sorted = posts
      .filter(Boolean)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return json({ posts: sorted });
  }

  if (req.method === 'POST') {
    let payload: Partial<WallPost>;
    try {
      payload = await req.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const location = String(payload.location || '').trim().slice(0, MAX_CITY);
    const issueKey = String(payload.issue_type || '').trim();
    const body = String(payload.body || '').trim().slice(0, MAX_BODY);

    if (!location || !issueKey || !body) {
      return json({ error: 'Missing required fields' }, 400);
    }
    if (!ISSUE_LABELS[issueKey]) {
      return json({ error: 'Invalid issue type' }, 400);
    }

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const post: WallPost = {
      id,
      location,
      issue_type: ISSUE_LABELS[issueKey],
      body,
      upvotes: 0,
      created_at: new Date().toISOString(),
    };

    await store.setJSON(id, post);
    return json({ post }, 201);
  }

  return json({ error: 'Method not allowed' }, 405);
};

export const config = { path: '/api/wall-posts' };
