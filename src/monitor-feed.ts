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

// strip CDATA wrapper + HTML tags + decode HTML entities
const clean = (raw: string) =>
    raw
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .trim()

const extract = (item: string, tag: string): string => {
    const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
    return m?.[1] ? clean(m[1]) : ''
}

export const fetchFeed = async (feed: typeof FEEDS[0]): Promise<FeedPost[]> => {
    try {
        const res = await fetch(feed.url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        const xml = await res.text()
        const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? []

        return items.slice(0, 10).map(item => {
            const title = extract(item, 'title')
            const url = extract(item, 'link')
            const guid = extract(item, 'guid') || crypto.randomUUID()
            const pubDate = extract(item, 'pubDate')

            // Fed's description == title, so content would be useless — skip it and let AI use title only
            const rawDesc = extract(item, 'description')
            const content = rawDesc !== title ? rawDesc : ''

            return { id: guid, source: feed.name, emoji: feed.emoji, title, content, url, pubDate }
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
                content: `Source: ${post.source}\nTitle: ${post.title}${post.content ? `\nContent: ${post.content}` : ''}`
            }
        ],
        max_tokens: 200
    })

    const text = response.choices[0]?.message?.content ?? '{}'

    try {
        const clean = text.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(clean)
        if (typeof parsed.reason !== 'string' || parsed.reason.trim() === '') {
            parsed.reason = 'ไม่สามารถวิเคราะห์ได้'
        }
        return parsed
    } catch {
        return { impact: 'NONE', reason: 'วิเคราะห์ไม่สำเร็จ', assets: [] }
    }
}