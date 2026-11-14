const fs = require('fs');

// قائمة البطولات العالمية والعربية المدعومة
const LEAGUES = [
  { code: 'uefa.champions', name: 'دوري أبطال أوروبا', order: 1 },
  { code: 'uefa.europa', name: 'الدوري الأوروبي', order: 2 },
  { code: 'eng.1', name: 'الدوري الإنجليزي الممتاز', order: 3 },
  { code: 'esp.1', name: 'الدوري الإسباني', order: 4 },
  { code: 'ita.1', name: 'الدوري الإيطالي', order: 5 },
  { code: 'ger.1', name: 'الدوري الألماني', order: 6 },
  { code: 'fra.1', name: 'الدوري الفرنسي', order: 7 },
  { code: 'ksa.1', name: 'دوري روشن السعودي', order: 8 },
  { code: 'mar.1', name: 'البطولة المغربية الاحترافية', order: 9 },
  { code: 'egy.1', name: 'الدوري المصري الممتاز', order: 10 },
  { code: 'afc.champions', name: 'دوري أبطال آسيا للنخبة', order: 11 },
  { code: 'caf.champions', name: 'دوري أبطال أفريقيا', order: 12 },
  { code: 'fifa.worldq.uefa', name: 'تصفيات كأس العالم - أوروبا', order: 13 },
  { code: 'fifa.worldq.conmebol', name: 'تصفيات كأس العالم - أمريكا الجنوبية', order: 14 },
  { code: 'fifa.worldq.caf', name: 'تصفيات كأس العالم - أفريقيا', order: 15 },
  { code: 'fifa.worldq.afc', name: 'تصفيات كأس العالم - آسيا', order: 16 },
  { code: 'uefa.nations', name: 'دوري الأمم الأوروبية', order: 17 },
  { code: 'caf.nations_qual', name: 'تصفيات كأس أمم أفريقيا', order: 18 },
  { code: 'fifa.friendly', name: 'مباريات دولية ودية', order: 19 },
  { code: 'eng.fa', name: 'كأس الاتحاد الإنجليزي', order: 20 },
  { code: 'esp.copa_del_rey', name: 'كأس ملك إسبانيا', order: 21 }
];

// توليد تواريخ 7 أيام (أمس + اليوم + 5 أيام قادمة)
function getWeekDates() {
  const dates = [];
  for (let i = -1; i <= 5; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    dates.push({ apiFormat: `${yyyy}${mm}${dd}`, isoFormat: `${yyyy}-${mm}-${dd}` });
  }
  return dates;
}

// قراءة الملف الحالي للحفاظ على الأخبار والإعدادات والتعديلات اليدوية
function readExistingJson(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error(`Warning reading ${filePath}:`, e.message);
  }
  return {
    settings: { siteTitle: 'ريف كورة', announcement: '' },
    leagues: [],
    matches: [],
    standings: {},
    news: []
  };
}

async function fetchLeagueMatches(league, dateObj) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?dates=${dateObj.apiFormat}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const events = data.events || [];

    return events.map(ev => {
      const comp = ev.competitions?.[0];
      const homeComp = comp?.competitors?.find(c => c.homeAway === 'home');
      const awayComp = comp?.competitors?.find(c => c.homeAway === 'away');

      const state = ev.status?.type?.state; // pre, in, post
      let status = 'NS';
      if (state === 'in') status = 'LIVE';
      else if (state === 'post') status = 'FT';

      // التوقيت بصيغة UTC القياسية + وقت HH:MM
      const kickOffDate = new Date(ev.date);
      const timeUTC = kickOffDate.toISOString().slice(11, 16);

      return {
        id: Number(ev.id),
        leagueCode: league.code,
        league: league.name,
        home: homeComp?.team?.shortDisplayName || homeComp?.team?.name || 'فريق 1',
        homeLogo: homeComp?.team?.logo || '',
        away: awayComp?.team?.shortDisplayName || awayComp?.team?.name || 'فريق 2',
        awayLogo: awayComp?.team?.logo || '',
        date: ev.date.slice(0, 10),
        timestamp: ev.date, // التوقيت الكامل لتحويله تلقائياً حسب دولة المستخدم
        time: timeUTC,
        status,
        scoreHome: status !== 'NS' ? Number(homeComp?.score ?? 0) : null,
        scoreAway: status !== 'NS' ? Number(awayComp?.score ?? 0) : null,
        minute: status === 'LIVE' ? (ev.status?.displayClock || 'مباشر') : null,
        channel: '',
        commentator: '',
        stadium: comp?.venue?.fullName || ''
      };
    });
  } catch (err) {
    return [];
  }
}

async function fetchLeagueStandings(league) {
  const url = `https://site.api.espn.com/apis/v2/sports/soccer/${league.code}/standings`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const entries = data.children?.[0]?.standings?.entries || [];
    if (!entries.length) return null;

    return entries.map((entry, idx) => {
      const getStat = (name) => {
        const st = entry.stats?.find(s => s.name === name);
        return st ? Number(st.value) : 0;
      };
      return {
        rank: getStat('rank') || idx + 1,
        team: entry.team?.shortDisplayName || entry.team?.name || '',
        logo: entry.team?.logos?.[0]?.href || '',
        played: getStat('gamesPlayed'),
        win: getStat('wins'),
        draw: getStat('ties'),
        lose: getStat('losses'),
        gf: getStat('pointsFor'),
        ga: getStat('pointsAgainst'),
        points: getStat('points')
      };
    }).sort((a, b) => a.rank - b.rank);
  } catch (err) {
    return null;
  }
}

async function main() {
  console.log('🚀 بدء التحديث الشامل لمباريات الأسبوع والترتيب...');
  const existingData = readExistingJson('data.json');
  const weekDates = getWeekDates();

  // خريطة للاحتفاظ بالتفاصيل اليدوية (القناة، المعلق) إن أضفتها من لوحة التحكم
  const manualDetailsMap = new Map();
  (existingData.matches || []).forEach(m => {
    manualDetailsMap.set(m.id, {
      channel: m.channel || '',
      commentator: m.commentator || ''
    });
  });

  let allFetchedMatches = [];
  const updatedStandings = { ...(existingData.standings || {}) };

  for (const league of LEAGUES) {
    // 1. سحب مباريات الأسبوع لكل بطولة
    const weekPromises = weekDates.map(d => fetchLeagueMatches(league, d));
    const leagueMatches = (await Promise.all(weekPromises)).flat();

    leagueMatches.forEach(m => {
      const saved = manualDetailsMap.get(m.id);
      if (saved) {
        if (saved.channel) m.channel = saved.channel;
        if (saved.commentator) m.commentator = saved.commentator;
      }
      allFetchedMatches.push(m);
    });

    // 2. سحب جدول الترتيب للبطولة
    const st = await fetchLeagueStandings(league);
    if (st && st.length > 0) {
      updatedStandings[league.name] = st;
    }
  }

  // إزالة التكرار وترتيب المباريات زمنياً
  const uniqueMatches = Array.from(new Map(allFetchedMatches.map(m => [m.id, m])).values())
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // تحديث قائمة البطولات النشطة
  const formattedLeagues = LEAGUES.map(l => ({
    id: l.code,
    name: l.name,
    logo: '',
    order: l.order,
    active: true
  }));

  const finalOutput = {
    updatedAt: new Date().toISOString(),
    settings: existingData.settings || { siteTitle: 'ريف كورة', announcement: '' },
    leagues: formattedLeagues,
    matches: uniqueMatches,
    standings: updatedStandings,
    news: existingData.news || []
  };

  // حفظ البيانات المباشرة للموقع والتطبيق والمسودة
  fs.writeFileSync('data.json', JSON.stringify(finalOutput, null, 2), 'utf8');
  fs.writeFileSync('app_data.json', JSON.stringify(finalOutput, null, 2), 'utf8');
  fs.writeFileSync('draft_data.json', JSON.stringify({ updatedAt: finalOutput.updatedAt, matches: uniqueMatches }, null, 2), 'utf8');

  console.log(`✅ تم تحديث ${uniqueMatches.length} مباراة للأسبوع و ${Object.keys(updatedStandings).length} جدول ترتيب بنجاح!`);
}

main();
