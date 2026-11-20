import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy web-push init
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

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const { userId, type } = await request.json();

        if (!userId || !type) {
            return NextResponse.json({ error: 'userId and type are required' }, { status: 400 });
        }

        let title = '';
        let body = '';

        switch (type) {
            case 'assignment':
                title = '🧪 Test: Tugas Baru!';
                body = 'Ini adalah test notifikasi assignment. Kamu di-assign untuk konten: "Contoh Post Instagram"';
                break;
            case 'deadline':
                title = '🧪 Test: Pengingat Deadline! 📅';
                body = '2 tugas deadline hari ini.\n1 tugas deadline besok.';
                break;
            case 'missed':
                title = '🧪 Test: Konten Belum Di-Share! ⚠️';
                body = '1 konten dari kemarin belum di-share!\n  • "Contoh Konten Reels" — segera share ke platform.';
                break;
            case 'owner':
                title = '🧪 Test: 📊 Laporan Tim Kamu';
                body = '🔴 1 konten belum di-share:\n  • "Contoh Post IG" (Andi)\n🟡 2 tugas deadline hari ini:\n  • "Video Reels Q2" (Budi)\n  • "Carousel Tips" (Citra)';
                break;
            case 'posting':
                title = '🧪 Test: 📤 Konten Harus Di-Post Hari Ini!';
                body = '3 konten dijadwalkan posting hari ini:\n  • "Tips Produktivitas" (Andi)\n  • "Behind the Scenes" (Budi)\n  • "Promo Akhir Bulan" (Citra)';
                break;
            default:
                return NextResponse.json({ error: 'Invalid type. Use: assignment, deadline, missed, owner, posting' }, { status: 400 });
        }

        // 1. Insert In-App Notification so it shows up in the bell dropdown
        const { error: inAppErr } = await supabaseAdmin.from('in_app_notifications').insert([{
            recipient_id: userId,
            title,
            message: body,
            type: type === 'assignment' ? 'assignment' : type === 'deadline' ? 'deadline' : type === 'owner' ? 'info' : type === 'posting' ? 'info' : 'warning',
            is_read: false,
        }]);

        if (inAppErr) {
            console.error('Failed to insert test in-app notification:', inAppErr);
            // Continue anyway – push might still work
        }

        // 2. Fetch push subscriptions
        const { data: subscriptions } = await supabaseAdmin
            .from('push_subscriptions')
            .select('id, subscription')
            .eq('user_id', userId);

        if (!subscriptions || subscriptions.length === 0) {
            return NextResponse.json({ message: 'Test notification sent (in-app only, no push devices registered)', sent: 0, inApp: !inAppErr });
        }

        const payload = JSON.stringify({
            title,
            body,
            icon: '/favicon.ico',
            url: '/',
            tag: `test-${type}`,
        });

        // Deduplicate
        const uniqueSubs = new Map();
        for (const sub of subscriptions) {
            try {
                const pushSub = typeof sub.subscription === 'string' ? JSON.parse(sub.subscription) : sub.subscription;
                if (pushSub?.endpoint) uniqueSubs.set(pushSub.endpoint, { id: sub.id, pushSub });
            } catch { /* skip */ }
        }

        let sent = 0;
        for (const { id, pushSub } of uniqueSubs.values()) {
            try {
                await (await getWebPush()).sendNotification(pushSub, payload);
                sent++;
            } catch (err: any) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await supabaseAdmin.from('push_subscriptions').delete().eq('id', id);
                }
            }
        }

        return NextResponse.json({ message: `Test notification sent (in-app + ${sent} push device(s))`, sent, inApp: !inAppErr });
    } catch (error: any) {
        console.error('Test notification error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
