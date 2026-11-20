import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — Fetch notification prefs for a user
export async function GET(request: NextRequest) {
    try {
        const userId = request.nextUrl.searchParams.get('userId');
        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('user_notification_prefs')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching notification prefs:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Return defaults if no row exists yet
        if (!data) {
            return NextResponse.json({
                user_id: userId,
                assignment: true,
                deadline_reminder: true,
                missed_share: true,
                owner_report: true,
                posting_reminder: true,
            });
        }

        return NextResponse.json(data);
    } catch (err: any) {
        console.error('GET notification-prefs error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST — Upsert notification prefs for a user
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, assignment, deadlineReminder, missedShare, ownerReport, postingReminder } = body;

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const row: Record<string, any> = { user_id: userId };
        if (typeof assignment === 'boolean') row.assignment = assignment;
        if (typeof deadlineReminder === 'boolean') row.deadline_reminder = deadlineReminder;
        if (typeof missedShare === 'boolean') row.missed_share = missedShare;
        if (typeof ownerReport === 'boolean') row.owner_report = ownerReport;
        if (typeof postingReminder === 'boolean') row.posting_reminder = postingReminder;

        const { data, error } = await supabaseAdmin
            .from('user_notification_prefs')
            .upsert(row, { onConflict: 'user_id' })
            .select('*')
            .single();

        if (error) {
            console.error('Error upserting notification prefs:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (err: any) {
        console.error('POST notification-prefs error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
