import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase Admin client — bypasses RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const { notificationId, workspaceId, userId, userEmail } = await request.json();

        if (!notificationId || !workspaceId || !userId || !userEmail) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // 1. Check if user is already a workspace member (prevent duplicates)
        const { data: existingMember } = await supabaseAdmin
            .from('workspace_members')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('user_id', userId)
            .maybeSingle();

        if (existingMember) {
            // Already a member, just mark notification as read
            await supabaseAdmin
                .from('in_app_notifications')
                .update({ is_read: true })
                .eq('id', notificationId);

            return NextResponse.json({ message: 'Already a member', alreadyMember: true });
        }

        // 1.5 Fetch the intended role from the notification message
        let intendedRole = 'member';
        const { data: notification } = await supabaseAdmin
            .from('in_app_notifications')
            .select('message')
            .eq('id', notificationId)
            .maybeSingle();

        if (notification && notification.message) {
            const msg = notification.message.toLowerCase();
            if (msg.includes('sebagai admin')) {
                intendedRole = 'admin';
            } else if (msg.includes('sebagai owner')) {
                intendedRole = 'owner';
            }
        }

        // 2. Insert into workspace_members (using admin client to bypass RLS)
        const { error: insertErr } = await supabaseAdmin
            .from('workspace_members')
            .insert([{
                workspace_id: workspaceId,
                user_id: userId,
                user_name: userEmail,
                role: intendedRole,
            }]);

        if (insertErr) {
            console.error('Workspace member insert error:', insertErr);
            return NextResponse.json(
                { error: 'Failed to join workspace' },
                { status: 500 }
            );
        }

        // 3. Mark notification as read
        await supabaseAdmin
            .from('in_app_notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        return NextResponse.json({ message: 'Successfully joined workspace' });

    } catch (error: any) {
        console.error('Accept invite error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
