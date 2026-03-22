import { ensureUserIndexes } from '@/lib/mongodb';

let initialized = false;

export async function GET() {
  if (!initialized) {
    try {
      await ensureUserIndexes();
      initialized = true;
      return Response.json({ success: true, message: 'Database initialized' });
    } catch (error) {
      console.error('Failed to initialize database:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }
  return Response.json({ success: true, message: 'Already initialized' });
}
