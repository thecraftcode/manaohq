import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy web-push init — only at runtime, never at build time
let webpushReady = false;
async function getWebPush() {
    const webpush = (await import('web-push')).default;
    if (!webpushReady) {
        const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
        if (vapidPublic && vapidPrivate) {
            webpush.setVapidDetails('mailto:admin@manaohq.com', vapidPublic, vapidPrivate);
            webpushReady = true;
        }
    }
    return webpush;
}

// Supabase Admin client (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const { userId, title, body, url } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Fetch all push subscriptions for this user
        const { data: subscriptions, error: fetchErr } = await supabaseAdmin
            .from('push_subscriptions')
            .select('id, subscription')
            .eq('user_id', userId);

        if (fetchErr) {
            console.error('Error fetching subscriptions:', fetchErr);
            return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
        }

        if (!subscriptions || subscriptions.length === 0) {
            return NextResponse.json({ message: 'No subscriptions found for this user' }, { status: 200 });
        }

        const payload = JSON.stringify({
            title: title || 'ManaoHQ System',
            body: body || 'Ada pembaruan baru!',
            icon: '/favicon.ico',
            url: url || '/',
            tag: title ? title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() : 'manao-update',
        });

        let sent = 0;
        let failed = 0;

        // Deduplicate subscriptions by endpoint
        const uniqueSubs = new Map();
        for (const sub of subscriptions) {
            try {
                const pushSubscription = typeof sub.subscription === 'string'
                    ? JSON.parse(sub.subscription)
                    : sub.subscription;

                if (pushSubscription && pushSubscription.endpoint) {
                    uniqueSubs.set(pushSubscription.endpoint, { id: sub.id, pushSubscription });
                }
            } catch (err) {
                console.warn('Invalid subscription format for sub ID:', sub.id);
            }
        }

        for (const { id, pushSubscription } of uniqueSubs.values()) {
            try {
                const wp = await getWebPush();
                await wp.sendNotification(pushSubscription, payload);
                sent++;
            } catch (err: any) {
                failed++;
                console.error(`Push failed for subscription ${id}:`, err.statusCode, err.message);

                // If subscription is expired or unsubscribed (410 Gone), delete it
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.log(`Removing expired subscription ${id}`);
                    await supabaseAdmin
                        .from('push_subscriptions')
                        .delete()
                        .eq('id', id);
                }
            }
        }

        return NextResponse.json({
            message: `Push notifications processed`,
            sent,
            failed,
            total: subscriptions.length,
        });
    } catch (error: any) {
        console.error('Send push error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
