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
        const { workspaceId, picName, picEmail, title, message, type, postId } = await request.json();

        if (!workspaceId || !picEmail) {
            return NextResponse.json({ error: 'workspaceId and picEmail are required' }, { status: 400 });
        }

        // 1. Resolve the recipient's Auth UUID from workspace_members (admin = bypass RLS)
        const { data: wsMember, error: wsErr } = await supabaseAdmin
            .from('workspace_members')
            .select('user_id')
            .eq('workspace_id', workspaceId)
            .eq('user_name', picEmail)
            .maybeSingle();

        if (wsErr) {
            console.error('workspace_members query error:', wsErr);
            return NextResponse.json({ error: 'Failed to resolve user' }, { status: 500 });
        }

        if (!wsMember?.user_id) {
            console.warn('No user_id found for', picEmail, 'in workspace', workspaceId);
            return NextResponse.json({ error: 'User not found in workspace' }, { status: 404 });
        }

        const recipientId = wsMember.user_id;

        // 2. Insert In-App Notification (admin = bypass RLS)
        const { error: notifErr } = await supabaseAdmin.from('in_app_notifications').insert([{
            workspace_id: workspaceId,
            recipient_id: recipientId,
            target_user: picName || picEmail,
            title: title || 'Notifikasi',
            message: message || '',
            type: type || 'assignment',
            post_id: postId || null,
        }]);

        if (notifErr) {
            console.error('Notification insert error:', notifErr);
            return NextResponse.json({ error: 'Failed to insert notification' }, { status: 500 });
        }

        // 3. Send Push Notification
        const { data: subscriptions } = await supabaseAdmin
            .from('push_subscriptions')
            .select('id, subscription')
            .eq('user_id', recipientId);

        if (subscriptions && subscriptions.length > 0) {
            const payload = JSON.stringify({
                title: title || 'ManaoHQ',
                body: message || 'Ada pembaruan baru!',
                icon: '/favicon.ico',
                url: postId ? `/?workspace=${workspaceId}&highlight_post=${postId}` : '/',
                tag: (title || 'manao').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
            });

            const uniqueSubs = new Map();
            for (const sub of subscriptions) {
                try {
                    const pushSub = typeof sub.subscription === 'string'
                        ? JSON.parse(sub.subscription)
                        : sub.subscription;
                    if (pushSub?.endpoint) {
                        uniqueSubs.set(pushSub.endpoint, { id: sub.id, pushSub });
                    }
                } catch { /* skip invalid */ }
            }

            for (const { id, pushSub } of uniqueSubs.values()) {
                try {
                    await (await getWebPush()).sendNotification(pushSub, payload);
                } catch (err: any) {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await supabaseAdmin.from('push_subscriptions').delete().eq('id', id);
                    }
                }
            }
        }

        return NextResponse.json({ message: 'Notification sent', recipientId });

    } catch (error: any) {
        console.error('Send notification error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
