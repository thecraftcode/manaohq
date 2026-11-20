// Note: This route only works in server mode, not in static export
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

// ── Supabase Admin (bypasses RLS) ───────────────────────────────────────────
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Helper: format date as YYYY-MM-DD ───────────────────────────────────────
function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ── Helper: send push to a user ─────────────────────────────────────────────
async function sendPushToUser(userId: string, title: string, body: string) {
    console.log(`[Push Debug] Looking for subscriptions for userId: ${userId}`);

    const { data: subscriptions, error } = await supabaseAdmin
        .from('push_subscriptions')
        .select('id, subscription')
        .eq('user_id', userId);

    if (error) {
        console.error(`[Push Debug] Error fetching subscriptions for ${userId}:`, error);
        return 0;
    }

    if (!subscriptions || subscriptions.length === 0) {
        console.log(`[Push Debug] No subscriptions found for userId: ${userId}`);
        return 0;
    }

    console.log(`[Push Debug] Found ${subscriptions.length} subscriptions for ${userId}`);

    const payload = JSON.stringify({
        title,
        body,
        icon: '/favicon.ico',
        url: '/',
    });

    // ── Deduplicate by Endpoint ──
    const uniqueSubsMap = new Map<string, { id: string, pushSubscription: any }>();
    for (const sub of subscriptions) {
        try {
            const pushSubscription = typeof sub.subscription === 'string'
                ? JSON.parse(sub.subscription)
                : sub.subscription;

            if (pushSubscription?.endpoint) {
                if (!uniqueSubsMap.has(pushSubscription.endpoint)) {
                    uniqueSubsMap.set(pushSubscription.endpoint, { id: sub.id, pushSubscription });
                }
            }
        } catch (e) {
            console.error(`[Push Debug] Parse error for sub ${sub.id}:`, e);
        }
    }

    console.log(`[Push Debug] After deduplication: ${uniqueSubsMap.size} unique devices for ${userId}`);

    let sent = 0;
    for (const [endpoint, { id, pushSubscription }] of uniqueSubsMap.entries()) {
        try {
            await (await getWebPush()).sendNotification(pushSubscription, payload);
            sent++;
        } catch (err: any) {
            console.error(`[Push Debug] Push failed for ${id} (${endpoint}):`, err.statusCode, err.message);

            if (err.statusCode === 410 || err.statusCode === 404) {
                console.log(`[Push Debug] Deleting expired sub ${id}`);
                await supabaseAdmin
                    .from('push_subscriptions')
                    .delete()
                    .eq('id', id);
            }
        }
    }
    return sent;
}

// ── Helper: fetch notification preferences for a user ───────────────────────
async function getUserNotifPrefs(userId: string) {
    const { data, error } = await supabaseAdmin
        .from('user_notification_prefs')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error || !data) {
        // Default: all enabled
        return { assignment: true, deadline_reminder: true, missed_share: true, owner_report: true };
    }
    return data;
}
// ── GET handler (triggered by cron) ─────────────────────────────────────────
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const now = new Date();
        const wibOffset = 7 * 60 * 60 * 1000;
        const wibNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + wibOffset);

        const today = formatDate(wibNow);
        const tomorrow = new Date(wibNow);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = formatDate(tomorrow);

        const yesterday = new Date(wibNow);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = formatDate(yesterday);

        console.log(`[Cron Debug] Date Range — Yesterday: ${yesterdayStr}, Today: ${today}, Tomorrow: ${tomorrowStr}`);

        // 3a. Fetch posts with deadlines today or tomorrow
        const completedStatuses = ['Published', 'Approved', 'Shared'];
        const { data: upcomingPosts, error: postsErr } = await supabaseAdmin
            .from('posts')
            .select('id, idea, deadline, pic, status, workspace_id')
            .in('deadline', [today, tomorrowStr])
            .not('status', 'in', `(${completedStatuses.join(',')})`);

        if (postsErr) throw postsErr;

        // 3b. Fetch missed shares
        const { data: missedSharePosts, error: missedErr } = await supabaseAdmin
            .from('posts')
            .select('id, idea, deadline, pic, status, workspace_id')
            .eq('deadline', yesterdayStr)
            .eq('status', 'Published');

        if (missedErr) throw missedErr;

        const allPosts = [...(upcomingPosts || []), ...(missedSharePosts || [])];
        console.log(`[Cron Debug] Total posts found: ${allPosts.length}`);

        if (allPosts.length === 0) {
            return NextResponse.json({ message: 'No deadlines or missing shares found', processed: 0 });
        }

        // 4. Resolve & Group by User
        const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
        const authMap = new Map((authList?.users || []).map(u => [u.email?.toLowerCase(), u.id]));
        console.log(`[Cron Debug] Total auth users loaded: ${authList?.users?.length || 0}`);

        const userSummary = new Map<string, {
            picName: string,
            todayTasks: string[],
            tomorrowTasks: string[],
            missedTasks: string[]
        }>();

        let totalSkipped = 0;

        for (const post of allPosts) {
            const picName = (post.pic ?? '').trim();
            console.log(`[Cron Debug] Processing task "${post.idea}" | PIC: "${picName}" | Deadline: ${post.deadline}`);

            if (!picName || picName === 'Unassigned') {
                console.log(`[Cron Debug] SKIP: PIC is empty or Unassigned`);
                totalSkipped++;
                continue;
            }

            const { data: member } = await supabaseAdmin
                .from('team_members')
                .select('id, user_id, email')
                .eq('name', picName)
                .maybeSingle();

            if (!member) {
                console.log(`[Cron Debug] SKIP: No team_member record found for name "${picName}"`);
                totalSkipped++;
                continue;
            }

            let uid = member.user_id;
            console.log(`[Cron Debug] Member found: ${member.email} | Existing user_id: ${uid}`);

            if (!uid && member.email) {
                uid = authMap.get(member.email.toLowerCase()) || null;
                console.log(`[Cron Debug] Resolving via email match: ${member.email} -> ${uid}`);
                if (uid) {
                    await supabaseAdmin
                        .from('team_members')
                        .update({ user_id: uid })
                        .eq('id', member.id);
                    console.log(`[Cron Debug] Auto-healed user_id in team_members for ${member.email}`);
                }
            }

            if (!uid) {
                console.log(`[Cron Debug] SKIP: Could not resolve Auth UUID for PIC "${picName}" with email "${member.email}"`);
                totalSkipped++;
                continue;
            }

            if (!userSummary.has(uid)) {
                userSummary.set(uid, { picName, todayTasks: [], tomorrowTasks: [], missedTasks: [] });
            }

            const summary = userSummary.get(uid)!;
            const taskTitle = (post.idea ?? '').trim() || 'Tanpa Judul';
            if (post.deadline === today) {
                summary.todayTasks.push(taskTitle);
            } else if (post.deadline === tomorrowStr) {
                summary.tomorrowTasks.push(taskTitle);
            } else if (post.deadline === yesterdayStr) {
                summary.missedTasks.push(taskTitle);
            }
        }

        console.log(`[Cron Debug] Users grouped: ${userSummary.size} | Total skipped: ${totalSkipped}`);

        // 5. Send notifications to PICs
        let totalUsersNotified = 0;
        let totalPushesSent = 0;

        for (const [uid, summary] of userSummary.entries()) {
            const totalCount = summary.todayTasks.length + summary.tomorrowTasks.length + summary.missedTasks.length;
            if (totalCount === 0) continue;

            // Check user's notification preferences
            const prefs = await getUserNotifPrefs(uid);

            // Filter based on preferences
            const hasDeadline = summary.todayTasks.length > 0 || summary.tomorrowTasks.length > 0;
            const hasMissed = summary.missedTasks.length > 0;

            if (hasDeadline && !prefs.deadline_reminder && !hasMissed) {
                console.log(`[Cron Debug] SKIP PIC ${summary.picName}: deadline_reminder disabled`);
                continue;
            }
            if (hasMissed && !prefs.missed_share && !hasDeadline) {
                console.log(`[Cron Debug] SKIP PIC ${summary.picName}: missed_share disabled`);
                continue;
            }

            let title = 'Pengingat Deadline! 📅';
            if (summary.missedTasks.length > 0) {
                title = '⚠️ Ada Konten Belum Di-Share!';
            }

            let bodyLines = [];
            if (summary.missedTasks.length > 0 && prefs.missed_share) {
                bodyLines.push(`${summary.missedTasks.length} konten dari kemarin belum di-share ke WA!`);
            }
            if (summary.todayTasks.length > 0 && prefs.deadline_reminder) {
                bodyLines.push(`${summary.todayTasks.length} tugas deadline hari ini.`);
            }
            if (summary.tomorrowTasks.length > 0 && prefs.deadline_reminder) {
                bodyLines.push(`${summary.tomorrowTasks.length} tugas deadline besok.`);
            }

            if (bodyLines.length === 0) {
                console.log(`[Cron Debug] SKIP PIC ${summary.picName}: all relevant prefs disabled`);
                continue;
            }

            const body = bodyLines.join('\n');
            console.log(`[Cron Debug] Attempting push to PIC ${summary.picName} (${uid}) | Message: ${body}`);

            const sent = await sendPushToUser(uid, title, body);
            totalPushesSent += sent;
            if (sent > 0) totalUsersNotified++;

            console.log(`[Cron Debug] PIC notification result for ${summary.picName}: ${sent} devices notified`);

            // Insert in-app notification for PIC
            await supabaseAdmin.from('in_app_notifications').insert([{
                recipient_id: uid,
                title: title,
                message: body,
                type: summary.missedTasks.length > 0 ? 'warning' : 'deadline',
                is_read: false,
            }]);
        }

        // 6. Send notifications to Workspace Owners
        // Group all tasks by workspace_id
        const workspaceTasks = new Map<string, {
            todayTasks: { title: string, pic: string }[],
            tomorrowTasks: { title: string, pic: string }[],
            missedTasks: { title: string, pic: string }[],
        }>();

        for (const post of allPosts) {
            const wsId = post.workspace_id;
            if (!wsId) continue;

            if (!workspaceTasks.has(wsId)) {
                workspaceTasks.set(wsId, { todayTasks: [], tomorrowTasks: [], missedTasks: [] });
            }
            const wsSummary = workspaceTasks.get(wsId)!;
            const taskTitle = (post.idea ?? '').trim() || 'Tanpa Judul';
            const picName = (post.pic ?? '').trim() || 'Belum di-assign';

            if (post.deadline === today) {
                wsSummary.todayTasks.push({ title: taskTitle, pic: picName });
            } else if (post.deadline === tomorrowStr) {
                wsSummary.tomorrowTasks.push({ title: taskTitle, pic: picName });
            } else if (post.deadline === yesterdayStr) {
                wsSummary.missedTasks.push({ title: taskTitle, pic: picName });
            }
        }

        let ownersNotified = 0;

        for (const [wsId, wsSummary] of workspaceTasks.entries()) {
            // Owner only gets notified for TODAY (H) and MISSED (H+1), not tomorrow
            const ownerRelevantCount = wsSummary.todayTasks.length + wsSummary.missedTasks.length;
            if (ownerRelevantCount === 0) continue;

            // Find workspace owner(s)
            const { data: owners } = await supabaseAdmin
                .from('workspace_members')
                .select('user_id')
                .eq('workspace_id', wsId)
                .eq('role', 'owner');

            if (!owners || owners.length === 0) continue;

            // Build owner-specific message
            let ownerTitle = '📊 Laporan Tim Kamu';
            if (wsSummary.missedTasks.length > 0) {
                ownerTitle = '⚠️ Tim Kamu Ada Tugas Terlambat!';
            }

            let ownerBodyLines: string[] = [];
            if (wsSummary.missedTasks.length > 0) {
                ownerBodyLines.push(`🔴 ${wsSummary.missedTasks.length} konten belum di-share:`);
                wsSummary.missedTasks.slice(0, 3).forEach(t => {
                    ownerBodyLines.push(`  • "${t.title}" (${t.pic})`);
                });
                if (wsSummary.missedTasks.length > 3) ownerBodyLines.push(`  ...dan ${wsSummary.missedTasks.length - 3} lainnya`);
            }
            if (wsSummary.todayTasks.length > 0) {
                ownerBodyLines.push(`🟡 ${wsSummary.todayTasks.length} tugas deadline hari ini:`);
                wsSummary.todayTasks.slice(0, 3).forEach(t => {
                    ownerBodyLines.push(`  • "${t.title}" (${t.pic})`);
                });
                if (wsSummary.todayTasks.length > 3) ownerBodyLines.push(`  ...dan ${wsSummary.todayTasks.length - 3} lainnya`);
            }

            const ownerBody = ownerBodyLines.join('\n');

            for (const owner of owners) {
                if (!owner.user_id) continue;

                // Check owner's notification preferences
                const ownerPrefs = await getUserNotifPrefs(owner.user_id);
                if (!ownerPrefs.owner_report) {
                    console.log(`[Cron Debug] SKIP owner ${owner.user_id}: owner_report disabled`);
                    continue;
                }

                // Skip if owner is also the PIC (they already got the PIC notification)
                if (userSummary.has(owner.user_id)) {
                    console.log(`[Cron Debug] Owner ${owner.user_id} is also a PIC, sending owner version too`);
                }

                console.log(`[Cron Debug] Sending owner notification to ${owner.user_id} for workspace ${wsId}`);
                const sent = await sendPushToUser(owner.user_id, ownerTitle, ownerBody);
                totalPushesSent += sent;
                if (sent > 0) ownersNotified++;

                // Insert in-app notification for Owner
                await supabaseAdmin.from('in_app_notifications').insert([{
                    workspace_id: wsId,
                    recipient_id: owner.user_id,
                    title: ownerTitle,
                    message: ownerBody,
                    type: 'info',
                    is_read: false,
                }]);
            }
        }

        // 7. Posting Reminder — notify owners about content scheduled to post today
        let postingRemindersNotified = 0;
        try {
            const sharedStatuses = ['Shared'];
            const { data: postingTodayPosts, error: postingErr } = await supabaseAdmin
                .from('posts')
                .select('id, idea, post_date, pic, status, workspace_id')
                .eq('post_date', today)
                .not('status', 'in', `(${sharedStatuses.join(',')})`);

            if (!postingErr && postingTodayPosts && postingTodayPosts.length > 0) {
                console.log(`[Cron Debug] Found ${postingTodayPosts.length} posts scheduled for today (${today})`);

                // Group by workspace
                const wsPostingMap = new Map<string, { title: string, pic: string, status: string }[]>();
                for (const p of postingTodayPosts) {
                    if (!p.workspace_id) continue;
                    if (!wsPostingMap.has(p.workspace_id)) wsPostingMap.set(p.workspace_id, []);
                    wsPostingMap.get(p.workspace_id)!.push({
                        title: (p.idea ?? '').trim() || 'Tanpa Judul',
                        pic: (p.pic ?? '').trim() || 'Belum di-assign',
                        status: p.status || 'Unknown',
                    });
                }

                for (const [wsId, posts] of wsPostingMap.entries()) {
                    const { data: owners } = await supabaseAdmin
                        .from('workspace_members')
                        .select('user_id')
                        .eq('workspace_id', wsId)
                        .eq('role', 'owner');

                    if (!owners || owners.length === 0) continue;

                    const postingTitle = `📤 ${posts.length} Konten Harus Di-Post Hari Ini!`;
                    let postingBodyLines: string[] = [];
                    posts.slice(0, 5).forEach(p => {
                        postingBodyLines.push(`  • "${p.title}" (${p.pic}) — ${p.status}`);
                    });
                    if (posts.length > 5) postingBodyLines.push(`  ...dan ${posts.length - 5} lainnya`);
                    const postingBody = postingBodyLines.join('\n');

                    for (const owner of owners) {
                        if (!owner.user_id) continue;

                        const prefs = await getUserNotifPrefs(owner.user_id);
                        if (!prefs.posting_reminder) {
                            console.log(`[Cron Debug] SKIP posting reminder for owner ${owner.user_id}: posting_reminder disabled`);
                            continue;
                        }

                        console.log(`[Cron Debug] Sending posting reminder to owner ${owner.user_id} for workspace ${wsId}`);
                        const sent = await sendPushToUser(owner.user_id, postingTitle, postingBody);
                        totalPushesSent += sent;
                        if (sent > 0) postingRemindersNotified++;

                        // Also insert in-app notification
                        await supabaseAdmin.from('in_app_notifications').insert([{
                            workspace_id: wsId,
                            recipient_id: owner.user_id,
                            title: postingTitle,
                            message: postingBody,
                            type: 'info',
                            is_read: false,
                        }]);
                    }
                }
            }
        } catch (postingErr) {
            console.warn('[Cron Debug] Posting reminder error (non-fatal):', postingErr);
        }

        const finalReport = `Found ${allPosts.length} tasks. Notified ${totalUsersNotified} PICs + ${ownersNotified} owners + ${postingRemindersNotified} posting reminders via ${totalPushesSent} devices. Skipped ${totalSkipped}.`;
        console.log(`[Cron Debug] ${finalReport}`);

        return NextResponse.json({
            message: finalReport,
            tasks_found: allPosts.length,
            users_notified: totalUsersNotified,
            owners_notified: ownersNotified,
            posting_reminders: postingRemindersNotified,
            total_pushes: totalPushesSent,
        });

    } catch (error: any) {
        console.error('[Cron Debug] Fatal error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
