import { NextResponse } from 'next/server';

// ── In-memory cache for IG caption data ──────────────────────────────────────
// Key: normalized IG URL → Value: { caption, thumbnailUrl, timestamp }
const igCache = new Map<string, { caption: string; thumbnailUrl: string; cachedAt: number }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — captions rarely change
const MAX_CACHE_SIZE = 500; // Prevent unbounded memory growth

/**
 * Normalize an Instagram URL to a consistent cache key.
 * e.g. "https://www.instagram.com/p/ABC123/?igsh=xxx" → "instagram.com/p/ABC123"
 */
function normalizeIgUrl(url: string): string {
    try {
        const u = new URL(url);
        // Remove query params and trailing slashes, lowercase host
        let path = u.pathname.replace(/\/+$/, '');
        return `${u.hostname.replace('www.', '')}${path}`.toLowerCase();
    } catch {
        return url.trim().toLowerCase();
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // ── Check cache first ────────────────────────────────────────────────
        const cacheKey = normalizeIgUrl(url);
        const cached = igCache.get(cacheKey);

        if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
            console.log(`[fetch-ig] CACHE HIT for: ${cacheKey}`);
            return NextResponse.json({
                caption: cached.caption,
                thumbnailUrl: cached.thumbnailUrl,
                fromCache: true,
            });
        }

        // ── Cache miss — fetch from RapidAPI ─────────────────────────────────
        console.log(`[fetch-ig] CACHE MISS for: ${cacheKey}`);

        const rapidApiHost = process.env.RAPIDAPI_HOST;
        const rapidApiKey = process.env.RAPIDAPI_KEY;

        if (!rapidApiHost || !rapidApiKey) {
            console.error('RapidAPI credentials missing from environment variables');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const options = {
            method: 'GET',
            headers: {
                'x-rapidapi-host': rapidApiHost,
                'x-rapidapi-key': rapidApiKey
            }
        };

        const targetUrl = `https://instagram-scraper-stable-api.p.rapidapi.com/get_media_data.php?reel_post_code_or_url=${encodeURIComponent(url)}&type=post`;

        const response = await fetch(targetUrl, options);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('RapidAPI response not ok:', response.status, errorText);

            // On 429, if we have stale cache, serve it rather than erroring
            if (response.status === 429 && cached) {
                console.log(`[fetch-ig] 429 rate limited — serving STALE cache for: ${cacheKey}`);
                return NextResponse.json({
                    caption: cached.caption,
                    thumbnailUrl: cached.thumbnailUrl,
                    fromCache: true,
                    stale: true,
                });
            }

            return NextResponse.json({ error: 'Failed to fetch from RapidAPI' }, { status: response.status });
        }

        const data = await response.json();

        // Add logging to see raw structure in terminal
        console.log("RAW IG DATA:", JSON.stringify(data, null, 2));

        let caption = '';

        // Safely extract from common RapidAPI/Insta Scraper paths:
        if (data?.edge_media_to_caption?.edges?.[0]?.node?.text) {
            caption = data.edge_media_to_caption.edges[0].node.text;
        } else if (data?.data?.edge_media_to_caption?.edges?.[0]?.node?.text) {
            caption = data.data.edge_media_to_caption.edges[0].node.text;
        } else if (data?.caption?.text) {
            caption = data.caption.text;
        } else if (data?.caption) {
            caption = typeof data.caption === 'string' ? data.caption : (data.caption.text || '');
        } else if (data?.data?.caption) {
            caption = typeof data.data.caption === 'string' ? data.data.caption : '';
        } else if (data?.text) {
            caption = data.text;
        } else if (data?.description) {
            caption = data.description;
        } else if (data?.title) {
            caption = data.title;
        }

        let thumbnailUrl = '';
        if (data?.thumbnail_src) {
            thumbnailUrl = data.thumbnail_src;
        } else if (data?.display_url) {
            thumbnailUrl = data.display_url;
        } else if (data?.graphql?.shortcode_media?.display_url) {
            thumbnailUrl = data.graphql.shortcode_media.display_url;
        }

        if (caption || thumbnailUrl) {
            // ── Store in cache ───────────────────────────────────────────────
            // Evict oldest entries if cache is full
            if (igCache.size >= MAX_CACHE_SIZE) {
                const oldestKey = igCache.keys().next().value;
                if (oldestKey) igCache.delete(oldestKey);
            }

            igCache.set(cacheKey, {
                caption,
                thumbnailUrl,
                cachedAt: Date.now(),
            });
            console.log(`[fetch-ig] CACHED result for: ${cacheKey} (cache size: ${igCache.size})`);

            return NextResponse.json({ caption, thumbnailUrl });
        } else {
            return NextResponse.json(
                { error: 'Extraction failed. Check server console for JSON structure.' },
                { status: 404 }
            );
        }

    } catch (error) {
        console.error('Error in fetch-ig route:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
