import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export const FEEDS = [
    {
        name: 'Trump',
        url: 'https://truthsocial.com/@realDonaldTrump/feed.rss',
        emoji: '🇺🇸'
    },
    {
        name: 'Reuters Business',
        url: 'https://feeds.reuters.com/reuters/businessNews',
        emoji: '📰'
    },
    {
        name: 'AP News',
        url: 'https://feeds.apnews.com/rss/apf-business',
        emoji: '📡'
    },
    {
        name: 'Federal Reserve',
        url: 'https://www.federalreserve.gov/feeds/press_all.xml',
        emoji: '🏦'
    }
]

export interface FeedPost {
    id: string
    source: string
    emoji: string
    title: string
    content: string
    url: string
    pubDate: string
}

export interface Analysis {
    impact: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
    reason: string
    assets: string[]
}

export const fetchFeed = async (feed: typeof FEEDS[0]): Promise<FeedPost[]> => {
    try {
        const res = await fetch(feed.url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        const xml = await res.text()
        const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? []

        return items.slice(0, 10).map(item => {
            const id = (item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] ?? crypto.randomUUID())
                .replace(/<!\[CDATA\[|\]\]>/g, '').trim()
            const title = (item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
                .replace(/<!\[CDATA\[|\]\]>/g, '').trim()
            const content = (item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? '')
                .replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim()

            // Fed RSS puts URL as plain text after self-closing <link/> tag
            // Other feeds wrap it in <link>url</link>
            const urlRaw = item.match(/<link>([^<]+)<\/link>/)?.[1]
                ?? item.match(/<link[^/]*\/>\s*([^\s<]+)/)?.[1]
                ?? item.match(/<feedburner:origLink>(.*?)<\/feedburner:origLink>/)?.[1]
                ?? ''
            const url = urlRaw.replace(/<!\[CDATA\[|\]\]>/g, '').trim()

            const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? ''

            return { id, source: feed.name, emoji: feed.emoji, title, content, url, pubDate }
        })
    } catch {
        return []
    }
}

export const analyzePost = async (post: FeedPost): Promise<Analysis> => {
    const response = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
            {
                role: 'system',
                content: `You are a strict financial analyst. Rate market impact conservatively.

HIGH: Rate changes, emergency actions, major policy shifts, geopolitical shocks, surprise earnings.
MEDIUM: New regulations with clear market effects, key personnel changes (e.g. Fed chair), major M&A.
LOW: Scheduled reports, routine meeting minutes, public comment periods, stress test announcements (pre-release).
NONE: Administrative notices, routine disclosures, non-market news.

Be conservative. Scheduled releases and routine Fed communications are almost always LOW or NONE.
IMPORTANT: Write the "reason" field in correct, natural Thai only. Do not mix scripts or output garbled text.
Respond ONLY with valid JSON, no markdown: {"impact": "HIGH|MEDIUM|LOW|NONE", "reason": "สาเหตุสั้นๆ ภาษาไทย ไม่เกิน 20 คำ", "assets": ["affected assets"]}`
            },
            {
                role: 'user',
                content: `Source: ${post.source}\nTitle: ${post.title}\nContent: ${post.content}`
            }
        ],
        max_tokens: 200
    })

    const text = response.choices[0]?.message?.content ?? '{}'

    try {
        // strip possible markdown fences
        const clean = text.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(clean)
        // validate reason is a non-empty string
        if (typeof parsed.reason !== 'string' || parsed.reason.trim() === '') {
            parsed.reason = 'ไม่สามารถวิเคราะห์ได้'
        }
        return parsed
    } catch {
        return { impact: 'NONE', reason: 'วิเคราะห์ไม่สำเร็จ', assets: [] }
    }
}