import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  try {
    const { endpoint } = await req.json();

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint parameter.' }, { status: 400 });
    }

    // Delete subscription based on the unique endpoint url
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);

    if (error) {
      console.error('Failed to delete push subscription:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Subscription removed.' });
  } catch (error: any) {
    console.error('Unsubscribe error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
