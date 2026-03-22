import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });

    // Check v2 Task Status
    const response = await fetch(`https://api.printful.com/v2/mockup-tasks?id=${taskId}`, {
      headers: { 'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}` },
    });

    const data = await response.json();
    const task = data.data?.[0]; // v2 wraps response in data array

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    if (task.status === 'completed') {
      const mockups = task.catalog_variant_mockups || [];
      const mockupUrl = mockups[0]?.mockup_url || mockups[0]?.extra?.[0]?.url;
      
      return NextResponse.json({ success: true, status: 'completed', mockupUrl });
    }

    return NextResponse.json({ success: true, status: task.status });
  } catch (error) { return NextResponse.json({ success: false, error: error.message }, { status: 500 }); }
}