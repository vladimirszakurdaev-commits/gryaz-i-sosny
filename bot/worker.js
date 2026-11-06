// Телеграм-бот «Грязь и сосны» для Cloudflare Workers.
// Секреты: BOT_TOKEN — ключ от @BotFather, WEBHOOK_SECRET — любое кодовое слово латиницей.
// Чат для заявок назначается командой /zayavki <кодовое слово> в нужной группе.
// Хранилище KV с именем привязки STATE — помнит, на каком шаге брони человек.

const SITE = 'https://vladimirszakurdaev-commits.github.io/gryaz-i-sosny/';
const POLICY = SITE + 'politika.html';
const PHONES = '+7 (917) 078-14-30 — Владимир, гид\n+7 (906) 381-29-41 — Антон, запись и группы';

// ---------- тексты ----------
const T = {
  hello: '<b>Грязь и сосны</b> — квадротуры по сосновым лесам Марий Эл и Чувашии. База — усадьба «Жемчужная» на берегу Волги.\n\nВыберите, что рассказать:',
  routes:
`<b>Туры с проживанием — на своих квадроциклах</b>
Все маршруты — кольца от усадьбы «Жемчужная»: утром старт, к ужину обратно.

🟢 <b>Кокшага</b> — 158 км. Берег Волги у Кокшайска, обед у Долгой Старицы, 2 брода.
🟠 <b>Марийское Полесье</b> — 147 км. Самый лесной: 93% пути по лесным дорогам, озёра Кумъяры.
🔵 <b>Междуречье Кокшаг</b> — 186 км. Больше всего бродов — 6, обед в междуречье.
🟣 <b>Сосновый уикенд</b> — 338 км за 2 дня: озеро Шап и Марийское Полесье, ночь в усадьбе.

<b>Прокат с гидом — квадроцикл даём мы</b>
🌲 <b>Лесная петля</b> — 50 км, около 4 часов, для новичков.
🌊 <b>Большой день</b> — 158 км, около 9 часов, для уверенных водителей.

Карты и фото — на сайте.`,
  prices:
`<b>Тур с проживанием, своя техника</b>
30–35 тыс. ₽ за участника: ночь в усадьбе и день на маршруте. Группа от 6 экипажей.
Входят проживание, завтрак, обед на трассе, гиды, машина сопровождения и страховка. Бензин, доставка техники, ужин, баня и SPA — отдельно.

<b>Прокат с гидом</b>
🌲 Лесная петля: 19 000 ₽ квадроцикл с водителем, пассажир 5 000 ₽.
🌊 Большой день: 37 000 ₽ квадроцикл с водителем, пассажир 8 500 ₽.
Входят бензин, шлем, перчатки, дождевик, гид и обед в лесу.

Точную сумму на вашу дату посчитаю, если нажмёте «Забронировать».`,
  faq:
`<b>Частые вопросы</b>

<b>Нужны ли права?</b>
На прокат — нет. Перед стартом инструктаж и пробный круг.

<b>Что входит в прокат?</b>
Квадроцикл с бензином, шлем, перчатки, дождевик, гид и обед на стоянке в лесу.

<b>Можно вдвоём на одном квадроцикле?</b>
Да, пассажир доплачивает отдельно.

<b>Сколько человек можно?</b>
Прокат — до 10 квадроциклов и до 20 человек с пассажирами. Тур на своей технике — от 6 экипажей.

<b>Как добраться до «Жемчужной»?</b>
Заволжье, левый берег Волги напротив Чебоксар. Йошкар-Ола — около 100 км, Казань — около 150, Нижний Новгород — около 250, Москва — около 650 по М-12. Где оставить машину с прицепом, расскажем при бронировании.

<b>Какие дни лучше?</b>
С местами в усадьбе проще с понедельника по четверг. На пятницу и субботу бронируйте заранее.

<b>Тимбилдинг для компании?</b>
Да: заберём команду в Чебоксарах, гид ведёт колонну, горячий обед на стоянке в лесу. Можно с ночёвкой в усадьбе.`,
  contacts: '<b>Контакты</b>\n' + PHONES + '\n\nСайт: ' + SITE,
};

const MENU = { keyboard: [[{ text: '📅 Забронировать' }], [{ text: '🗺 Маршруты' }, { text: '💰 Цены' }], [{ text: '❓ Вопросы' }, { text: '📞 Контакты' }]], resize_keyboard: true };

// ---------- расчёт, как на сайте ----------
const ACC = { std: [3500, 0, 'Номер «Стандарт», по 2'], pl: [4500, 0, 'Номер «Полулюкс», по 2'], lux: [5500, 0, 'Номер «Люкс», по 2'], vip: [8500, 0, 'VIP-люкс, по 2'], apt: [9000, 0, 'Апартаменты, по 2'], rus: [15000, 12, 'Малый дом «Русский», до 12'], big: [45000, 18, 'Большой гостевой дом, до 18'] };
const MEAL = { full: [1250, 1, 'Полный пансион'], bl: [850, 1, 'Завтрак и обед на трассе'], l: [500, 1, 'Только обед на трассе'], none: [0, 0, 'Без питания'] };
const up = v => Math.ceil(v / 100) * 100;
const rub = v => Math.round(v).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';
const ppl = n => n + ' ' + (n % 10 === 1 && n % 100 !== 11 ? 'человек' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'человека' : 'человек'));

function tour(s) {
  const C = s.crews, N = Math.max(C, s.people), D = s.days, a = ACC[s.acc], m = MEAL[s.meal];
  const units = a[1] ? Math.ceil(N / a[1]) : Math.ceil(N / 2), acc = units * a[0] * D, fee = D === 2 ? 47000 : 27500;
  const raw = fee + acc / N + m[0] * D, pp = up(raw), feeRev = fee * N + (pp - raw) * N;
  const cost = 2 * 6000 * D + 2500 * D + (m[1] ? 4000 * D : 0) + 300 * N * D + 3500 * D + 3 * m[0] * D;
  const res = feeRev - cost - feeRev * 0.06;
  return { ok: res > 0, total: pp * N, head: `${rub(pp)} за участника`,
    sub: `${N} участников, ${C} экипажей · ${D === 2 ? 'Сосновый уикенд, 2 дня' : '1 день, 1 ночь'} · ${a[2]} · ${m[2].toLowerCase()}` };
}
function rent(s) {
  const L = s.route === 'long', A = s.quads, P = Math.min(s.pax, A), g = s.who === 'guest', night = !g && !!s.night, h = L ? 9 : 4;
  const pq = L ? 37000 : 19000, pp = L ? 8500 : 5000, n = A + P;
  let rev = A * pq + P * pp; const rentFull = h * (3000 * A + 500 * P);
  let cost = 0.9 * rentFull + 500 * (n + 2) + 5000 + (g ? (L ? 1500 : 500) : (L ? 2500 : 1500)) + 300 * n + (g ? 0.1 * (rev - rentFull) : 0);
  let nightRev = 0; if (night) { nightRev = 1500 * n; cost += 750 * n }
  rev += nightRev; cost += rev * (g ? 0.04 : 0.06);
  return { ok: rev - cost > 0, total: rev, head: `${rub(rev)} за группу`,
    sub: `${L ? 'Большой день, около 9 часов' : 'Лесная петля, около 4 часов'} · ${A} квадр. · ${ppl(n)} · ${g ? 'отдыхаем в «Жемчужной»' : 'трансфер из Чебоксар'}${night ? ' · с ночёвкой (проживание оплачивается усадьбе)' : ''}` };
}

// ---------- Telegram ----------
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}
async function cfg(env, k) { try { return await env.STATE.get('cfg:' + k) } catch { return null } }
async function adminChat(env) { return (await cfg(env, 'admin')) || env.ADMIN_CHAT_ID || null }
async function botName(env) { return (await cfg(env, 'username')) || env.BOT_USERNAME || '' }
// заявка в рабочий чат; если чат ещё не назначен — копим и отправим потом
async function toAdmin(env, text) {
  const id = await adminChat(env);
  if (!id) { const q = JSON.parse((await cfg(env, 'queue')) || '[]'); q.push(text); await env.STATE.put('cfg:queue', JSON.stringify(q.slice(-50))); return { ok: true, queued: true } }
  return send(env, id, text);
}
const send = (env, chat, text, extra = {}) => tg(env, 'sendMessage', { chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });
const ik = rows => ({ reply_markup: { inline_keyboard: rows } });
const btn = (text, data) => ({ text, callback_data: data });
const chunk = (a, n) => a.reduce((r, x, i) => (i % n ? r[r.length - 1].push(x) : r.push([x]), r), []);

async function getS(env, uid) { try { return JSON.parse(await env.STATE.get('s:' + uid)) || {} } catch { return {} } }
const putS = (env, uid, s) => env.STATE.put('s:' + uid, JSON.stringify(s), { expirationTtl: 86400 });
const delS = (env, uid) => env.STATE.delete('s:' + uid);

const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const nice = iso => { const d = new Date(iso + 'T12:00:00Z'); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}, ${WD[d.getUTCDay()]}` };
function dates(off) {
  const out = [], now = new Date(Date.now() + 3 * 3600e3); // Москва
  for (let i = 1 + off; i <= 21 + off; i++) { const d = new Date(now); d.setUTCDate(d.getUTCDate() + i); const iso = d.toISOString().slice(0, 10); out.push(btn(`${WD[d.getUTCDay()]} ${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`, 'd:' + iso)) }
  const rows = chunk(out, 3); rows.push(off ? [btn('← Раньше', 'dp:' + (off - 21)), btn('Позже →', 'dp:' + (off + 21))] : [btn('Позже →', 'dp:21')]); return rows;
}

// шаги брони: что спросить дальше
function nextStep(s) {
  if (!s.mode) return ['Какой формат?', [[btn('🏕 Тур с проживанием, своя техника', 'm:tour')], [btn('🏍 Прокат с гидом, квадроцикл наш', 'm:rent')]]];
  if (s.mode === 'tour') {
    if (!s.days) return ['Сколько дней?', [[btn('1 день, 1 ночь', 'days:1'), btn('Сосновый уикенд, 2 дня', 'days:2')]]];
    if (!s.date) return ['Выберите дату заезда:', dates(s.doff || 0)];
    if (!s.crews) return ['Сколько экипажей (квадроциклов)? Минимум 6.', chunk([6, 7, 8, 10, 12, 15, 20, 25, 30].map(n => btn(String(n), 'crews:' + n)), 3)];
    if (!s.people) { const c = s.crews; return ['Сколько всего участников вместе с пассажирами?', chunk([...new Set([c, c + 2, c + 4, Math.round(c * 1.5), c * 2])].map(n => btn(String(n), 'people:' + n)), 3)] }
    if (!s.acc) return ['Как разместиться в «Жемчужной»?', Object.entries(ACC).map(([k, v]) => [btn(v[2], 'acc:' + k)])];
    if (!s.meal) return ['Питание:', Object.entries(MEAL).map(([k, v]) => [btn(v[2], 'meal:' + k)])];
  } else {
    if (!s.route) return ['Какой маршрут?', [[btn('🌲 Лесная петля — 4 часа, 50 км', 'route:short')], [btn('🌊 Большой день — 9 часов, 158 км', 'route:long')]]];
    if (!s.date) return ['Выберите дату:', dates(s.doff || 0)];
    if (!s.quads) return ['Сколько квадроциклов?', chunk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => btn(String(n), 'quads:' + n)), 5)];
    if (s.pax === undefined) return ['Сколько пассажиров (вдвоём на одном квадроцикле)?', chunk(Array.from({ length: s.quads + 1 }, (_, i) => btn(String(i), 'pax:' + i)), 6)];
    if (!s.who) return ['Откуда едете?', [[btn('Отдыхаю в «Жемчужной»', 'who:guest')], [btn('Нужен трансфер из Чебоксар', 'who:city')]]];
    if (s.who === 'city' && s.night === undefined) return ['С ночёвкой в «Жемчужной»? Ужин и завтрак — 1 500 ₽ на человека, проживание по ценам усадьбы.', [[btn('Без ночёвки', 'night:0'), btn('С ночёвкой', 'night:1')]]];
  }
  return null;
}

async function ask(env, chat, s, msgId) {
  const st = nextStep(s);
  if (st) {
    const body = { chat_id: chat, text: st[0], parse_mode: 'HTML', reply_markup: { inline_keyboard: [...st[1], [btn('✖ Отменить', 'x')]] } };
    return msgId ? tg(env, 'editMessageText', { ...body, message_id: msgId }) : tg(env, 'sendMessage', body);
  }
  const r = s.mode === 'tour' ? tour(s) : rent(s);
  if (!r.ok) {
    const text = `<b>${nice(s.date)}</b>\nПростите, данная дата уже занята. Выберите другую дату или позвоните нам — подберём вариант.\n\n${PHONES}`;
    return tg(env, 'editMessageText', { chat_id: chat, message_id: msgId, text, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[btn('📅 Другая дата', 'redate')], [btn('↺ Начать заново', 'restart')]] } });
  }
  const text = `<b>${nice(s.date)}</b>\n${esc(r.sub)}\n\n<b>${r.head}</b>${r.total !== undefined && s.mode === 'tour' ? `\nИтого за группу: ${rub(r.total)}` : ''}\n\nРасчёт предварительный, точную сумму подтвердим по телефону.`;
  return tg(env, 'editMessageText', { chat_id: chat, message_id: msgId, text, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[btn('✅ Забронировать', 'book')], [btn('📅 Другая дата', 'redate'), btn('↺ Заново', 'restart')]] } });
}

async function onCallback(env, q) {
  const uid = q.from.id, chat = q.message.chat.id, mid = q.message.message_id, data = q.data;
  await tg(env, 'answerCallbackQuery', { callback_query_id: q.id });
  let s = await getS(env, uid);
  if (data === 'x') { await delS(env, uid); return tg(env, 'editMessageText', { chat_id: chat, message_id: mid, text: 'Бронирование отменено.' }) }
  if (data === 'restart') { s = {}; await putS(env, uid, s); return ask(env, chat, s, mid) }
  if (data === 'redate') { delete s.date; s.doff = 0; await putS(env, uid, s); return ask(env, chat, s, mid) }
  if (data.startsWith('dp:')) { s.doff = Math.max(0, +data.slice(3)); await putS(env, uid, s); return ask(env, chat, s, mid) }
  if (data.startsWith('d:')) { s.date = data.slice(2); await putS(env, uid, s); return ask(env, chat, s, mid) }
  if (data === 'book') {
    s.await = 'contact'; await putS(env, uid, s);
    await tg(env, 'editMessageReplyMarkup', { chat_id: chat, message_id: mid, reply_markup: { inline_keyboard: [] } });
    return send(env, chat, `Нажмите кнопку ниже, чтобы отправить номер телефона — Антон перезвонит и подтвердит бронь.\n\nОтправляя номер, вы соглашаетесь на обработку персональных данных для связи по заявке: <a href="${POLICY}">политика</a>.`,
      { reply_markup: { keyboard: [[{ text: '📱 Отправить мой номер', request_contact: true }], [{ text: 'Отмена' }]], resize_keyboard: true, one_time_keyboard: true } });
  }
  const [k, v] = data.split(':');
  const num = ['days', 'crews', 'people', 'quads', 'pax', 'night'];
  if (k === 'm') { s = { mode: v } }
  else if (k in { days: 1, crews: 1, people: 1, acc: 1, meal: 1, route: 1, quads: 1, pax: 1, who: 1, night: 1 }) s[k] = num.includes(k) ? +v : v;
  await putS(env, uid, s);
  return ask(env, chat, s, mid);
}

async function finishBooking(env, msg, s) {
  const c = msg.contact, u = msg.from;
  const r = s.mode === 'tour' ? tour(s) : rent(s);
  const who = [c.first_name, c.last_name].filter(Boolean).join(' ');
  const text = `🆕 <b>Заявка из Телеграма</b>\n\n<b>${esc(who)}</b>\n📱 ${esc(c.phone_number.startsWith('+') ? c.phone_number : '+' + c.phone_number)}${u.username ? `\n✉️ @${esc(u.username)}` : ''}\n\n📅 ${nice(s.date)}\n${s.mode === 'tour' ? 'Тур с проживанием, своя техника' : 'Прокат с гидом'}\n${esc(r.sub)}\n💰 ${r.head}${s.mode === 'tour' ? ' · итого ' + rub(r.total) : ''}`;
  await toAdmin(env, text);
  await delS(env, u.id);
  return send(env, msg.chat.id, 'Спасибо! Заявка отправлена. Антон перезвонит, чтобы подтвердить бронь.', { reply_markup: MENU });
}

async function onMessage(env, msg) {
  const chat = msg.chat, priv = chat.type === 'private', text = (msg.text || '').trim();
  const me = await botName(env);
  const cmd = text.startsWith('/') ? text.split(/[\s@]/)[0].toLowerCase() : '';

  if (msg.new_chat_members && !priv) {
    const names = msg.new_chat_members.filter(m => !m.is_bot).map(m => esc(m.first_name)).join(', ');
    if (!names) return;
    return send(env, chat.id, `Добро пожаловать, ${names}! 🌲\nЗдесь анонсы выездов, фото с маршрутов и ответы на вопросы. Маршруты — /routes, цены — /prices, частые вопросы — /faq.`,
      me ? ik([[{ text: '📅 Забронировать в личке у бота', url: `https://t.me/${me}?start=book` }]]) : {});
  }
  if (cmd === '/id') return send(env, chat.id, `ID этого чата: <code>${chat.id}</code>`);
  if (cmd === '/zayavki') {
    if (text.split(/\s+/)[1] !== env.WEBHOOK_SECRET) return send(env, chat.id, 'Неверное кодовое слово.');
    await env.STATE.put('cfg:admin', String(chat.id));
    const q = JSON.parse((await cfg(env, 'queue')) || '[]'); await env.STATE.delete('cfg:queue');
    await send(env, chat.id, '✅ Теперь заявки будут приходить в этот чат.' + (q.length ? ` Пришли накопленные: ${q.length}.` : ''));
    for (const t of q) await send(env, chat.id, t);
    return;
  }

  if (priv) {
    const s = await getS(env, msg.from.id);
    if (msg.contact && s.await === 'contact') {
      if (msg.contact.user_id && msg.contact.user_id !== msg.from.id) return send(env, chat.id, 'Нужен именно ваш номер — нажмите кнопку «Отправить мой номер».');
      return finishBooking(env, msg, s);
    }
    if (text === 'Отмена') { await delS(env, msg.from.id); return send(env, chat.id, 'Хорошо, отменил.', { reply_markup: MENU }) }
    if (cmd === '/start' && text.includes('book') || cmd === '/book' || text === '📅 Забронировать') { const ns = {}; await putS(env, msg.from.id, ns); return ask(env, chat.id, ns) }
    if (cmd === '/start') return send(env, chat.id, T.hello, { reply_markup: MENU });
  }
  const map = { '/routes': 'routes', '🗺 Маршруты': 'routes', '/prices': 'prices', '💰 Цены': 'prices', '/faq': 'faq', '❓ Вопросы': 'faq', '/contacts': 'contacts', '📞 Контакты': 'contacts' };
  const key = map[cmd] || (priv ? map[text] : null);
  if (key) return send(env, chat.id, T[key], ik([[{ text: '🌐 Сайт с картами', url: SITE }], ...(priv ? [[btn('📅 Забронировать', 'restart')]] : me ? [[{ text: '📅 Забронировать', url: `https://t.me/${me}?start=book` }]] : [])]));
  if (cmd === '/book' && !priv && me) return send(env, chat.id, 'Бронирование — в личке у бота, чтобы ваш телефон не видели все участники группы:', ik([[{ text: '📅 Забронировать', url: `https://t.me/${me}?start=book` }]]));
  if (priv) return send(env, chat.id, 'Выберите в меню ниже, что рассказать, или нажмите «Забронировать». Если вопрос не из списка — позвоните:\n' + PHONES, { reply_markup: MENU });
}

// ---------- заявки с сайта ----------
const CORS = { 'Access-Control-Allow-Origin': 'https://vladimirszakurdaev-commits.github.io', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
async function siteBooking(env, req) {
  let b; try { b = await req.json() } catch { return new Response('bad', { status: 400, headers: CORS }) }
  const f = k => esc(String(b[k] ?? '').slice(0, 500));
  if (!b['Имя'] || !b['Телефон']) return new Response('bad', { status: 400, headers: CORS });
  const text = `🆕 <b>Заявка с сайта</b>\n\n<b>${f('Имя')}</b>\n📱 ${f('Телефон')}\n💬 ${f('Комментарий')}\n\n📅 ${f('Дата')}\n${f('Формат')}\n${f('Параметры')}\n${f('Расчёт')}\n💰 Итого: ${f('Итого')}`;
  const r = await toAdmin(env, text);
  return new Response(JSON.stringify({ ok: !!r.ok }), { status: r.ok ? 200 : 502, headers: { ...CORS, 'content-type': 'application/json' } });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/booking' && req.method === 'POST') return siteBooking(env, req);
    if (url.pathname === '/tg' && req.method === 'POST') {
      if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) return new Response('no', { status: 403 });
      const u = await req.json();
      try { if (u.callback_query) await onCallback(env, u.callback_query); else if (u.message) await onMessage(env, u.message) } catch (e) { console.log(e.stack || e) }
      return new Response('ok');
    }
    if (url.pathname === '/setup') {
      if (url.searchParams.get('key') !== env.WEBHOOK_SECRET) return new Response('Неверный ключ', { status: 403 });
      const a = await tg(env, 'setWebhook', { url: url.origin + '/tg', secret_token: env.WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query'] });
      const cmds = [['book', 'Забронировать выезд'], ['routes', 'Маршруты'], ['prices', 'Цены'], ['faq', 'Частые вопросы'], ['contacts', 'Контакты']].map(([command, description]) => ({ command, description }));
      const b = await tg(env, 'setMyCommands', { commands: cmds });
      const c = await tg(env, 'setMyDescription', { description: 'Квадротуры по сосновым лесам Марий Эл и Чувашии с базой в усадьбе «Жемчужная». Маршруты, цены и бронирование.' });
      const me = await tg(env, 'getMe', {}); if (me.ok) await env.STATE.put('cfg:username', me.result.username);
      const ok = a.ok && b.ok;
      return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font:18px system-ui;padding:24px;background:#f4efe7;color:#1b2a22"><h2>${ok ? '✅ Бот подключён' : '❌ Ошибка'}</h2><p>${ok ? 'Бот @' + esc(me.result?.username) + ' готов.<br><br>Последний шаг: в группе «Заявки» напишите<br><b>/zayavki ' + esc(env.WEBHOOK_SECRET) + '</b>' : esc(JSON.stringify([a, b, c]))}</p></body>`, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    return new Response('Грязь и сосны — бот работает');
  }
};
