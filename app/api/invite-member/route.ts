import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase Admin client — bypasses RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

export async function POST(request: NextRequest) {
    try {
        const { email, workspaceId, workspaceName, inviterId, role = 'Member' } = await request.json();

        // ── Validation ──────────────────────────────────────────────
        if (!email || !workspaceId) {
            return NextResponse.json(
                { error: 'Email dan workspaceId wajib diisi.' },
                { status: 400 }
            );
        }

        const targetEmail = email.trim().toLowerCase();

        // ── 1. Look up user via Supabase Auth Admin (bypasses RLS) ──
        const { data: authList, error: authErr } = await supabaseAdmin.auth.admin.listUsers();

        if (authErr) {
            console.error('Auth admin listUsers error:', authErr);
            return NextResponse.json(
                { error: 'Gagal mencari data pengguna.' },
                { status: 500 }
            );
        }

        const targetUser = authList.users.find(
            (u) => u.email?.toLowerCase() === targetEmail
        );

        if (!targetUser) {
            return NextResponse.json(
                { error: 'User dengan email ini belum terdaftar di ManaoHQ.' },
                { status: 404 }
            );
        }

        // ── 2. Check if already a workspace member ──────────────────
        const { data: existingMember } = await supabaseAdmin
            .from('workspace_members')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('user_id', targetUser.id)
            .maybeSingle();

        if (existingMember) {
            return NextResponse.json(
                { error: 'User ini sudah menjadi anggota workspace ini.' },
                { status: 409 }
            );
        }

        // ── 3. Check for existing pending invite ────────────────────
        const { data: existingInvite } = await supabaseAdmin
            .from('in_app_notifications')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('recipient_id', targetUser.id)
            .eq('type', 'invite')
            .eq('is_read', false)
            .maybeSingle();

        if (existingInvite) {
            return NextResponse.json(
                { error: 'Undangan sudah pernah dikirim dan belum diterima.' },
                { status: 409 }
            );
        }

        // ── 4. Send invite notification ─────────────────────────────
        const wsName = workspaceName || 'sebuah workspace';
        const { error: notifErr } = await supabaseAdmin
            .from('in_app_notifications')
            .insert([{
                workspace_id: workspaceId,
                recipient_id: targetUser.id,
                target_user: targetUser.email,
                title: 'Undangan Workspace! 🎉',
                message: `Anda telah diundang untuk bergabung ke "${wsName}" sebagai ${role}.`,
                type: 'invite',
            }]);

        if (notifErr) {
            console.error('Notification insert error:', notifErr);
            return NextResponse.json(
                { error: 'Gagal mengirim undangan.' },
                { status: 500 }
            );
        }

        // ── 5. Sync with team_members (Allow immediate assignment) ──
        const { data: existingTeamMember } = await supabaseAdmin
            .from('team_members')
            .select('id')
            .eq('email', targetEmail)
            .maybeSingle();

        if (existingTeamMember) {
            await supabaseAdmin
                .from('team_members')
                .update({ user_id: targetUser.id })
                .eq('id', existingTeamMember.id);
        } else {
            await supabaseAdmin
                .from('team_members')
                .insert([{
                    name: targetUser.user_metadata?.name || targetEmail.split('@')[0],
                    email: targetEmail,
                    user_id: targetUser.id,
                    role: role
                }]);
        }

        // ── 6. Trigger push notification (native web-push) IN BACKGROUND ──
        // Do not await this block so the API responds instantly
        (async () => {
            try {
                console.log('CCTV PUSH [invite-member] - targetUser.id:', targetUser.id, '| targetUser.email:', targetUser.email);

                const { data: subscriptions } = await supabaseAdmin
                    .from('push_subscriptions')
                    .select('id, subscription')
                    .eq('user_id', targetUser.id);

                if (subscriptions && subscriptions.length > 0) {
                    const wp = await getWebPush();
                    const payload = JSON.stringify({
                        title: 'Undangan Workspace!',
                        body: `Anda telah diundang ke Workspace "${wsName}" sebagai ${role}. Cek sekarang!`,
                        icon: '/favicon.ico',
                        url: '/',
                        tag: 'undangan-workspace',
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
                            await wp.sendNotification(pushSub, payload);
                        } catch (err: any) {
                            if (err.statusCode === 410 || err.statusCode === 404) {
                                await supabaseAdmin.from('push_subscriptions').delete().eq('id', id);
                            }
                        }
                    }
                }

            } catch (pushErr) {
                console.log('Push notification execution failed:', pushErr);
            }
        })();

        // ── 7. Success ──────────────────────────────────────────────
        return NextResponse.json({
            message: `Undangan berhasil dikirim ke ${targetUser.email}!`,
            recipientEmail: targetUser.email,
        });

    } catch (error: any) {
        console.error('Invite member error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
