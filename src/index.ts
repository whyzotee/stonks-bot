import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js'
import { handleSetup, handleStock, handleAlert, handleClear } from './commands'
import { getGuildChannel } from './db'
import { getStockPrice } from './stock'
import { startMonitor } from './monitor'

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
})

const commands = [
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('ตั้งค่าช่องนี้สำหรับแจ้งเตือนหุ้น'),
    new SlashCommandBuilder()
        .setName('stock')
        .setDescription('ดูราคาหุ้น')
        .addStringOption(opt =>
            opt.setName('symbol')
                .setDescription('ชื่อหุ้น เช่น AAPL, TSLA')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('alert')
        .setDescription('ตั้งแจ้งเตือนราคาหุ้นตามเวลา')
        .addStringOption(opt =>
            opt.setName('symbol')
                .setDescription('ชื่อหุ้น เช่น AAPL')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('time')
                .setDescription('เวลาแจ้งเตือน เช่น 09:00')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('ลบข้อความใน channel นี้')
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setDescription('จำนวนข้อความที่ต้องการลบ')
                .setRequired(false)
        )
        .addBooleanOption(opt =>
            opt.setName('all')
                .setDescription('ลบข้อความทั้งหมด')
                .setRequired(false)
        ),
]

client.once('clientReady', async () => {
    console.log(`Bot online: ${client.user?.tag}`)

    // Register slash commands
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!)
    await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
        { body: commands.map(c => c.toJSON()) }
    )

    // startScheduler(client)
    startMonitor(client)
    console.log('Commands registered');
})

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return

    if (interaction.commandName === 'setup') await handleSetup(interaction)
    if (interaction.commandName === 'stock') await handleStock(interaction)
    if (interaction.commandName === 'alert') await handleAlert(interaction)
    if (interaction.commandName === 'clear') await handleClear(interaction)
})

client.on('messageCreate', async message => {
    if (message.author.bot) return

    const channelId = getGuildChannel(message.guildId!)
    if (!channelId || message.channelId !== channelId) return

    const symbol = message.content.trim().toUpperCase()
    if (!/^[A-Z]{1,10}$/.test(symbol)) return

    const data = await getStockPrice(symbol)
    if (!data) {
        await message.reply(`❌ ไม่พบข้อมูลหุ้น **${symbol}**`)
        return
    }

    const arrow = data.change >= 0 ? '🟢' : '🔴'
    const sign = data.change >= 0 ? '+' : ''

    await message.reply(
        `${arrow} **${data.symbol}**\n` +
        `💰 ราคา: **${data.price.toFixed(2)} ${data.currency}**\n` +
        `📊 เปลี่ยนแปลง: ${sign}${data.change.toFixed(2)} (${sign}${data.changePercent.toFixed(2)}%)`
    )
})

client.login(process.env.DISCORD_TOKEN)