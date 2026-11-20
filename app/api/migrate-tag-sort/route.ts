import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        // Add sort_order column if it doesn't exist
        // We use a raw SQL approach via rpc, but since that may not be available,
        // we'll just try to update with sort_order and if it fails, we know the column doesn't exist

        // Try to read a row with sort_order to check if column exists
        const { data: testData, error: testError } = await supabaseAdmin
            .from('workspace_tags')
            .select('id, sort_order')
            .limit(1);

        if (testError && testError.message?.includes('sort_order')) {
            // Column doesn't exist - need to add it via SQL
            const { error: rpcError } = await supabaseAdmin.rpc('exec_sql', {
                sql: 'ALTER TABLE workspace_tags ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0'
            });

            if (rpcError) {
                // If rpc doesn't exist, try direct approach
                return NextResponse.json({
                    error: 'Please add sort_order column manually: ALTER TABLE workspace_tags ADD COLUMN sort_order integer DEFAULT 0;',
                    needsManualMigration: true,
                }, { status: 500 });
            }

            // Populate sort_order for existing rows based on created_at order
            const { data: allTags } = await supabaseAdmin
                .from('workspace_tags')
                .select('id, workspace_id, category, created_at')
                .order('created_at', { ascending: true });

            if (allTags) {
                const groups: Record<string, typeof allTags> = {};
                allTags.forEach(tag => {
                    const key = `${tag.workspace_id}_${tag.category}`;
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(tag);
                });

                for (const group of Object.values(groups)) {
                    for (let i = 0; i < group.length; i++) {
                        await supabaseAdmin
                            .from('workspace_tags')
                            .update({ sort_order: i })
                            .eq('id', group[i].id);
                    }
                }
            }

            return NextResponse.json({ message: 'sort_order column added and populated.' });
        }

        // Column already exists — just ensure all rows have sort_order populated
        const { data: unordered } = await supabaseAdmin
            .from('workspace_tags')
            .select('id, workspace_id, category, created_at, sort_order')
            .is('sort_order', null)
            .order('created_at', { ascending: true });

        if (unordered && unordered.length > 0) {
            // Group by workspace_id + category
            const groups: Record<string, typeof unordered> = {};
            unordered.forEach(tag => {
                const key = `${tag.workspace_id}_${tag.category}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(tag);
            });

            for (const group of Object.values(groups)) {
                for (let i = 0; i < group.length; i++) {
                    await supabaseAdmin
                        .from('workspace_tags')
                        .update({ sort_order: i })
                        .eq('id', group[i].id);
                }
            }
        }

        return NextResponse.json({ message: 'sort_order column already exists. Data populated.' });
    } catch (error: any) {
        console.error('Migration error:', error);
        return NextResponse.json({ error: error.message || 'Migration failed' }, { status: 500 });
    }
}
