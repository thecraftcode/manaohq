import { NextRequest, NextResponse } from 'next/server';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY!;

const SYSTEM_PROMPT = `You are an expert Social Media Creative Director. Create a structured content brief based on the user's rough idea. Respond in Indonesian.
IMPORTANT: You MUST return the output ONLY in valid HTML format. Do NOT use Markdown syntax like ** or #. Use HTML tags only.
Use <strong> for bold headings, <p> for paragraphs, and <ul><li> for lists if necessary.
Strictly use this format:
<p><strong>Objective:</strong> [1 sentence]</p>
<p><strong>Target Audience:</strong> [1 sentence]</p>
<p><strong>Key Message:</strong> [1 sentence]</p>
<p><strong>Visual Concept:</strong> [2-3 sentences describing the visual/video]</p>`;

export async function POST(request: NextRequest) {
    try {
        const { idea, pillar, funnel, type } = await request.json();

        if (!idea?.trim()) {
            return NextResponse.json(
                { error: 'Ide konten wajib diisi.' },
                { status: 400 }
            );
        }

        if (!DEEPSEEK_API_KEY) {
            return NextResponse.json(
                { error: 'DEEPSEEK_API_KEY belum dikonfigurasi di .env.local' },
                { status: 500 }
            );
        }

        // Build context-rich prompt
        let userPrompt = `Ide konten: "${idea.trim()}"`;
        if (pillar) userPrompt += `\nContent Pillar: ${pillar}`;
        if (funnel) userPrompt += `\nFunnel Stage: ${funnel}`;
        if (type) userPrompt += `\nContent Type: ${type}`;

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'deepseek-reasoner',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.7,
                max_tokens: 2048,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('DeepSeek API error:', response.status, errText);

            if (response.status === 429) {
                return NextResponse.json(
                    { error: 'Rate limit DeepSeek. Tunggu sebentar lalu coba lagi.' },
                    { status: 429 }
                );
            }

            return NextResponse.json(
                { error: `DeepSeek API error: ${response.status}` },
                { status: 502 }
            );
        }

        const data = await response.json();
        console.log('[AI Brief] Full response:', JSON.stringify(data?.choices?.[0], null, 2));
        const generatedText = data?.choices?.[0]?.message?.content || '';

        if (!generatedText) {
            return NextResponse.json(
                { error: 'DeepSeek tidak menghasilkan respons.' },
                { status: 500 }
            );
        }

        return NextResponse.json({ brief: generatedText });
    } catch (error: any) {
        console.error('Generate brief error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
