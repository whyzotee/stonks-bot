import { Database } from 'bun:sqlite'
import { mkdirSync } from 'fs'

mkdirSync('data', { recursive: true })

const db = new Database('data/config.db', { create: true })

db.run(`
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    time TEXT NOT NULL,
    UNIQUE(guild_id, symbol, time)
  )
`)

export const setGuildChannel = (guildId: string, channelId: string) => {
    db.run(`
    INSERT INTO guild_config (guild_id, channel_id)
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET channel_id = ?
  `, [guildId, channelId, channelId])
}

export const getGuildChannel = (guildId: string): string | null => {
    const row = db.query('SELECT channel_id FROM guild_config WHERE guild_id = ?').get(guildId) as { channel_id: string } | null
    return row?.channel_id ?? null
}

export const addAlert = (guildId: string, symbol: string, time: string) => {
    db.run(`
    INSERT OR IGNORE INTO alerts (guild_id, symbol, time)
    VALUES (?, ?, ?)
  `, [guildId, symbol, time])
}

export const getAlerts = (guildId: string) => {
    return db.query('SELECT symbol, time FROM alerts WHERE guild_id = ?').all(guildId) as { symbol: string, time: string }[]
}

export const removeAlert = (guildId: string, symbol: string) => {
    db.run('DELETE FROM alerts WHERE guild_id = ? AND symbol = ?', [guildId, symbol])
}