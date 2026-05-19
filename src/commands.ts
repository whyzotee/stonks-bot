import { ChatInputCommandInteraction, MessageFlags, TextChannel } from 'discord.js'
import { setGuildChannel, addAlert, getAlerts, removeAlert } from './db'
import { getStockPrice } from './stock'

export const handleSetup = async (interaction: ChatInputCommandInteraction) => {
    setGuildChannel(interaction.guildId!, interaction.channelId)
    await interaction.reply({
        content: `✅ ตั้งค่าช่องแจ้งเตือนเป็น <#${interaction.channelId}> แล้วครับ`,
        flags: MessageFlags.Ephemeral
    })
}

export const handleStock = async (interaction: ChatInputCommandInteraction) => {
    const symbol = interaction.options.getString('symbol', true).toUpperCase()
    await interaction.deferReply()

    const data = await getStockPrice(symbol)
    if (!data) {
        await interaction.editReply(`❌ ไม่พบข้อมูลหุ้น **${symbol}**`)
        return
    }

    const arrow = data.change >= 0 ? '🟢' : '🔴'
    const sign = data.change >= 0 ? '+' : ''

    await interaction.editReply(
        `${arrow} **${data.symbol}**\n` +
        `💰 ราคา: **${data.price.toFixed(2)} ${data.currency}**\n` +
        `📊 เปลี่ยนแปลง: ${sign}${data.change.toFixed(2)} (${sign}${data.changePercent.toFixed(2)}%)`
    )
}

export const handleAlert = async (interaction: ChatInputCommandInteraction) => {
    const symbol = interaction.options.getString('symbol', true).toUpperCase()
    const time = interaction.options.getString('time', true)

    // validate time format
    if (!/^\d{2}:\d{2}$/.test(time)) {
        await interaction.reply({
            content: '❌ รูปแบบเวลาไม่ถูกต้อง ใช้รูปแบบ HH:MM เช่น 09:00',
            flags: MessageFlags.Ephemeral
        })
        return
    }

    addAlert(interaction.guildId!, symbol, time)
    await interaction.reply({
        content: `✅ ตั้งแจ้งเตือน **${symbol}** เวลา **${time}** แล้วครับ`,
        flags: MessageFlags.Ephemeral
    })
}

export const handleClear = async (interaction: ChatInputCommandInteraction) => {
    const amount = interaction.options.getInteger('amount') ?? null
    const all = interaction.options.getBoolean('all') ?? false

    if (!all && !amount) {
        await interaction.reply({
            content: '❌ ระบุจำนวนข้อความหรือใช้ all:true ครับ',
            flags: MessageFlags.Ephemeral
        })
        return
    }

    const channel = interaction.channel as TextChannel
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    let deleted = 0

    if (all) {
        let fetched
        do {
            fetched = await channel.messages.fetch({ limit: 100 })
            for (const message of fetched.values()) {
                await message.delete()
                deleted++
            }
        } while (fetched.size > 0)
    } else {
        const messages = await channel.messages.fetch({ limit: amount! })
        for (const message of messages.values()) {
            await message.delete()
            deleted++
        }
    }

    await interaction.editReply({
        content: `✅ ลบข้อความ ${deleted} ข้อความแล้วครับ`
    })
}