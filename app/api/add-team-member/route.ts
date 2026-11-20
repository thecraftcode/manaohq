import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase Admin client — bypasses RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const { name, email, role, workspace_id } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: 'Email wajib diisi.' },
                { status: 400 }
            );
        }

        const targetEmail = email.trim().toLowerCase();

        // ── 1. Resolve Auth user_id if possible ─────────────────────
        let resolvedUserId: string | null = null;
        try {
            const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
            const matchingUser = authList?.users?.find(u => u.email?.toLowerCase() === targetEmail);
            if (matchingUser) {
                resolvedUserId = matchingUser.id;
            }
        } catch (e) {
            console.warn('[Add Member] Auth resolution failed:', e);
        }

        // ── 2. Check for existing team member ───────────────────────
        const { data: existing } = await supabaseAdmin
            .from('team_members')
            .select('*')
            .eq('email', targetEmail)
            .maybeSingle();

        if (existing) {
            // Update user_id if we resolved it and it was missing
            if (resolvedUserId && !existing.user_id) {
                await supabaseAdmin
                    .from('team_members')
                    .update({ user_id: resolvedUserId })
                    .eq('email', targetEmail);
            }
            return NextResponse.json({
                message: 'Team member sudah ada.',
                member: { ...existing, user_id: resolvedUserId || existing.user_id },
            });
        }

        // ── 3. Insert new team member ───────────────────────────────
        const { data, error } = await supabaseAdmin
            .from('team_members')
            .insert([{
                name: name || targetEmail.split('@')[0],
                email: targetEmail,
                role: role || 'Member',
                user_id: resolvedUserId,
                workspace_id: workspace_id || null // Ensure we link to workspace if provided
            }])
            .select('*')
            .single();

        if (error) {
            console.error('Team member insert error:', error);
            return NextResponse.json(
                { error: 'Gagal menambahkan team member.' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: 'Team member berhasil ditambahkan!',
            member: data,
        });
    } catch (error: any) {
        console.error('Add team member error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
