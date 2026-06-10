import { Client, TextChannel, EmbedBuilder } from 'discord.js'
import { FEEDS, fetchFeed, analyzePost, type FeedPost } from './monitor-feed'
import { getGuildChannel } from './db'

const CHECK_INTERVAL = 60 * 1000
const seenIds = new Set<string>()

const isValidUrl = (url: string) => {
    try { new URL(url); return true } catch { return false }
}

const parseDate = (pubDate: string): Date | null => {
    if (!pubDate) return null
    const d = new Date(pubDate)
    return isNaN(d.getTime()) ? null : d
}

const IMPACT_CONFIG = {
    HIGH: { color: 0xE74C3C, emoji: '🚨', label: 'HIGH IMPACT' },
    MEDIUM: { color: 0xF39C12, emoji: '⚠️', label: 'MEDIUM IMPACT' },
} as const

const formatEmbed = (post: FeedPost, impact: 'HIGH' | 'MEDIUM', reason: string, assets: string[]) => {
    const cfg = IMPACT_CONFIG[impact]
    const date = parseDate(post.pubDate)

    const embed = new EmbedBuilder()
        .setColor(cfg.color)
        .setAuthor({ name: `${post.emoji} ${post.source}` })
        .setTitle(`${cfg.emoji} ${post.title}`)
        .addFields({ name: '💬 วิเคราะห์', value: reason })
        .setFooter({ text: cfg.label })
        .setTimestamp(date ?? new Date())

    if (isValidUrl(post.url)) embed.setURL(post.url)
    if (assets.length > 0) embed.addFields({ name: '📊 กระทบ', value: assets.join(', ') })

    return embed
}

export const startMonitor = (client: Client) => {
    console.log('Monitor started')

    setInterval(async () => {
        for (const feed of FEEDS) {
            const posts = await fetchFeed(feed)

            for (const post of posts) {
                if (seenIds.has(post.id)) continue
                seenIds.add(post.id)

                const analysis = await analyzePost(post)
                if (!['HIGH', 'MEDIUM'].includes(analysis.impact)) continue

                const impact = analysis.impact as 'HIGH' | 'MEDIUM'
                const embed = formatEmbed(post, impact, analysis.reason, analysis.assets)

                for (const guild of client.guilds.cache.values()) {
                    const channelId = getGuildChannel(guild.id)
                    if (!channelId) continue

                    const channel = client.channels.cache.get(channelId) as TextChannel
                    if (!channel) continue

                    await channel.send({ embeds: [embed] })
                }
            }
        }
    }, CHECK_INTERVAL)
}