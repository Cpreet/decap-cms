import { getStore } from '@netlify/blobs';

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
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let payload: { id?: string; delta?: number };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const id = String(payload.id || '').trim();
  const delta = payload.delta === -1 ? -1 : 1;
  if (!id) return json({ error: 'Missing id' }, 400);

  const store = getStore('wall-posts');
  const post = (await store.get(id, { type: 'json' })) as WallPost | null;
  if (!post) return json({ error: 'Post not found' }, 404);

  post.upvotes = Math.max(0, (post.upvotes || 0) + delta);
  await store.setJSON(id, post);

  return json({ upvotes: post.upvotes });
};

export const config = { path: '/api/wall-upvote' };
