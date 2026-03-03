import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  try {
    const { userId, subscription } = await req.json();

    if (!userId || !subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    // Save or update subscription
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updated_at: new Date().toISOString()
      }, { onConflict: 'endpoint' });

    if (error) {
      console.error('Failed to insert push subscription:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Subscription saved.' });
  } catch (error: any) {
    console.error('Subscription error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
