import webpush from 'web-push';
import { supabaseAdmin } from './supabaseServer';

const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').replace(/['"]/g, '').trim();
const privateKey = (process.env.VAPID_PRIVATE_KEY || '').replace(/['"]/g, '').trim();

let vapidConfigured = false;

if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL!,
      publicKey,
      privateKey
    );
    vapidConfigured = true;
  } catch (e) {
    console.error('Failed to set VAPID details (key may be malformed):', e);
  }
} else {
  console.warn('VAPID keys are missing! Web push notifications will not work.');
}

export async function sendPushNotification(subscription: webpush.PushSubscription, payload: any) {
  if (!vapidConfigured) {
    console.warn('Skipping push notification: VAPID not configured.');
    return;
  }
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (error: any) {
    console.error('Push notification failed:', error);
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription has expired or is no longer valid
      console.log('Subscription expired. Deleting from DB...');
      try {
        await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
      } catch (dbError) {
        console.error('Failed to delete expired subscription:', dbError);
      }
    }
  }
}
