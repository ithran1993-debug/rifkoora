const fs = require('fs');
const cheerio = require('cheerio');

async function scrapeYallakora() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  // صيغة التاريخ في يلا كورة MM/DD/YYYY
  const [y, m, d] = today.split('-');
  const ykDate = `${m}/${d}/${y}`;
  const url = `https://www.yallakora.com/match-center?date=${ykDate}`;

  console.log(`Fetching matches from: ${url}`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  const matches = [];
  let idCounter = 1;

  $('.matchCard').each((_, card) => {
    const league = $(card).find('.tourTitle h2').text().trim();

    $(card).find('.liItem').each((_, item) => {
      const home = $(item).find('.teamA p').text().trim();
      const away = $(item).find('.teamB p').text().trim();
      const homeLogo = $(item).find('.teamA img').attr('src') || '';
      const awayLogo = $(item).find('.teamB img').attr('src') || '';
      const time = $(item).find('.MResult .time').text().trim();
      const statusText = $(item).find('.matchStatus span').text().trim();
      const channel = $(item).find('.channel').text().trim();

      const scores = $(item).find('.MResult .score');
      const sH = $(scores[0]).text().trim();
      const sA = $(scores[1]).text().trim();

      let status = 'NS';
      if (statusText.includes('انتهت')) status = 'FT';
      else if (statusText.includes('جارية') || statusText.includes('الشوط') || statusText.includes('استراحة')) status = 'LIVE';

      if (home && away) {
        matches.push({
          id: Date.now() + idCounter++,
          league: league || 'مباريات اليوم',
          home,
          away,
          homeLogo,
          awayLogo,
          date: today,
          time: time || '20:00',
          status,
          scoreHome: sH !== '-' && sH !== '' ? Number(sH) : null,
          scoreAway: sA !== '-' && sA !== '' ? Number(sA) : null,
          minute: status === 'LIVE' ? statusText : null,
          channel: channel || ''
        });
      }
    });
  });

  const draft = {
    updatedAt: new Date().toISOString(),
    matches
  };

  fs.writeFileSync('draft_data.json', JSON.stringify(draft, null, 2), 'utf8');
  console.log(`Saved ${matches.length} matches to draft_data.json`);
}

scrapeYallakora().catch(err => {
  console.error('Scraping failed:', err);
  process.exit(1);
});
