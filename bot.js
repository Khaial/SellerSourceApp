require('dotenv').config();
const {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder, EmbedBuilder
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length < 10) return raw;
  return `+1(${digits.slice(0,3)})-${digits.slice(3,6)}-${digits.slice(6)}`;
}

function addBusinessDays(date, n) {
  let d = new Date(date), added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

function toDisplayDate(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

// Parse DD/MM/YYYY → Date object (for Notion ISO format)
function parseDisplayDate(str) {
  const parts = str.split('/');
  if (parts.length !== 3) return new Date();
  return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
}

// ─── Google Sheets Sync ────────────────────────────────────────────────────────

async function syncToSheets(data) {
  if (!process.env.APPS_SCRIPT_URL) return { ok: false, msg: 'Not configured' };
  try {
    const params = new URLSearchParams({
      name:          data.name,
      email:         data.email         || '',
      phone:         data.phone,
      state:         data.state         || '',
      contactMedium: data.medium,
      notes:         data.notes         || '',
      nextContact:   data.nextContact,
    });
    await fetch(`${process.env.APPS_SCRIPT_URL}?${params.toString()}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

// ─── Notion Sync ──────────────────────────────────────────────────────────────

async function syncToNotion(data) {
  const token = process.env.NOTION_TOKEN;
  const dbId  = process.env.NOTION_DATABASE_ID;
  if (!token || !dbId) return { ok: false, msg: 'Not configured' };

  try {
    const nextDate = parseDisplayDate(data.nextContact);
    const isoNext  = nextDate.toISOString().split('T')[0];

    const body = {
      parent: { database_id: dbId },
      properties: {
        'Name':            { title:  [{ text: { content: data.name } }] },
        'Phone':           { phone_number: data.phone },
        'Email':           { email: data.email || null },
        'State':           { rich_text: [{ text: { content: data.state || '' } }] },
        'Contact Medium':  { select: { name: data.medium } },
        'Notes':           { rich_text: [{ text: { content: data.notes || '' } }] },
        'Next Contact':    { date: { start: isoNext } },
        'Date Added':      { date: { start: new Date().toISOString().split('T')[0] } },
      }
    };

    const res = await fetch('https://api.notion.com/v1/pages', {
      method:  'POST',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Content-Type':   'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Notion API error');
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

// ─── Slash Command ─────────────────────────────────────────────────────────────

const command = new SlashCommandBuilder()
  .setName('addcontact')
  .setDescription('Log a new seller or agent contact to your database')
  .addStringOption(o => o.setName('name').setDescription('Full name').setRequired(true))
  .addStringOption(o => o.setName('phone').setDescription('10-digit phone number').setRequired(true))
  .addStringOption(o => o.setName('medium').setDescription('How you reached them').setRequired(true)
    .addChoices(
      { name: '📞 Phone', value: 'Phone' },
      { name: '💬 SMS',   value: 'SMS'   },
      { name: '📧 Email', value: 'Email' },
      { name: '🔗 Other', value: 'Other' },
    ))
  .addStringOption(o => o.setName('email').setDescription('Email address'))
  .addStringOption(o => o.setName('state').setDescription('US state (e.g. Texas)'))
  .addStringOption(o => o.setName('medium_other').setDescription('If Other — platform name e.g. Facebook, Instagram, LinkedIn'))
  .addStringOption(o => o.setName('notes').setDescription('Summary: what was established, motivation, next focus'))
  .addStringOption(o => o.setName('next_contact').setDescription('Next contact date DD/MM/YYYY — blank = auto 2 business days'));

// ─── Register Commands on Startup ─────────────────────────────────────────────

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: [command.toJSON()] }
    );
    console.log('✅ /addcontact slash command registered');
  } catch (e) {
    console.error('❌ Failed to register commands:', e.message);
  }
}

// ─── Bot Events ───────────────────────────────────────────────────────────────

client.once('ready', async () => {
  console.log(`\n✅ Bot online as: ${client.user.tag}`);
  console.log(`📋 Sheets sync:  ${process.env.APPS_SCRIPT_URL ? 'enabled' : 'not configured'}`);
  console.log(`📝 Notion sync:  ${process.env.NOTION_TOKEN ? 'enabled' : 'not configured'}\n`);
  await registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'addcontact') return;

  await interaction.deferReply();

  // ── Collect inputs ──
  const name        = interaction.options.getString('name');
  const phone       = formatPhone(interaction.options.getString('phone'));
  const medium      = interaction.options.getString('medium');
  const mediumOther = interaction.options.getString('medium_other') || '';
  const email       = interaction.options.getString('email')        || '';
  const state       = interaction.options.getString('state')        || '';
  const notes       = interaction.options.getString('notes')        || '';
  const rawNext     = interaction.options.getString('next_contact');
  const nextContact = rawNext || toDisplayDate(addBusinessDays(new Date(), 2));
  const displayMedium = medium === 'Other' ? (mediumOther || 'Other') : medium;

  const data = { name, phone, email, state, medium: displayMedium, notes, nextContact };

  // ── Sync in parallel ──
  const [sheetsResult, notionResult] = await Promise.all([
    syncToSheets(data),
    syncToNotion(data),
  ]);

  // ── Build sync status string ──
  const syncLines = [];
  if (process.env.APPS_SCRIPT_URL)
    syncLines.push(sheetsResult.ok ? '✅ Google Sheets' : `❌ Sheets — ${sheetsResult.msg}`);
  if (process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID)
    syncLines.push(notionResult.ok ? '✅ Notion' : `❌ Notion — ${notionResult.msg}`);
  const syncStatus = syncLines.length ? syncLines.join('\n') : '⚠️ No destinations configured in .env';

  // ── Build embed ──
  const embed = new EmbedBuilder()
    .setColor(0x185FA5)
    .setTitle(`📋  ${name}`)
    .setTimestamp()
    .addFields(
      { name: '📞 Phone',        value: phone,                     inline: true  },
      { name: '📍 State',        value: state       || '—',        inline: true  },
      { name: '📡 Medium',       value: displayMedium,             inline: true  },
      { name: '📧 Email',        value: email       || '—',        inline: true  },
      { name: '📅 Next contact', value: nextContact,               inline: true  },
      { name: '🔄 Sync',         value: syncStatus,                inline: true  },
    );

  if (notes) embed.addFields({ name: '📝 Notes', value: notes });

  await interaction.editReply({ embeds: [embed] });
});

// ─── Start ────────────────────────────────────────────────────────────────────

console.log("DISCORD_TOKEN exists:", !!process.env.DISCORD_TOKEN);
console.log("Type:", typeof process.env.DISCORD_TOKEN);

if (process.env.DISCORD_TOKEN) {
  console.log("Length:", process.env.DISCORD_TOKEN.length);
}

console.log(Object.keys(process.env).filter(k =>
  k.includes("TOKEN") || k.includes("DISCORD")
));

console.log(process.env.DISCORD_TOKEN);

client.login(process.env.DISCORD_TOKEN);
