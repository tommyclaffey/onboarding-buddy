// Demo company "Brightside" with the cast from the Figma design. Dates are relative to today:
// Maya starts on the Monday at least 7 days away, so the story always reads "starts Monday".
//   node server/seed.mjs            → wipe and reseed
//   node server/seed.mjs --if-empty → seed only if there's no data (production first boot)
import fs from 'node:fs';
import { hashPassword } from './auth.mjs';
import { defaultDbPath, now, openDb, tx } from './db.mjs';
import { addDays, instantiateTasks, todayIso } from './queries.mjs';

export const SEED_PASSWORD = process.env.SEED_PASSWORD || 'buddy-demo-2026';

function nextMondayAtLeast(days) {
  const d = new Date(todayIso() + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function seed(db) {
  const pw = await hashPassword(SEED_PASSWORD);
  const mayaStart = nextMondayAtLeast(7);
  return tx(db, () => {
    const org = Number(db.prepare('INSERT INTO orgs(name, slug, created_at) VALUES (?,?,?)').run('Brightside', 'brightside', now()).lastInsertRowid);
    const U = {};
    const addUser = (key, o) => {
      U[key] = Number(db.prepare(
        `INSERT INTO users(org_id,email,name,title,team,photo,role,duty,start_date,quote,ask_about,password_hash,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(org, o.email, o.name, o.title, o.team, o.photo, o.role || 'member', o.duty || null, o.start || null, o.quote || null,
        o.ask ? JSON.stringify(o.ask) : null, pw, now()).lastInsertRowid);
    };
    addUser('priya', { email: 'priya@brightside.test', name: 'Priya Rao', title: 'People Ops Lead', team: 'People', photo: '/photos/priya.jpg', role: 'admin', duty: 'people_ops' });
    addUser('dev', { email: 'dev@brightside.test', name: 'Dev Okafor', title: 'IT Lead', team: 'IT', photo: '/photos/dev.jpg', duty: 'it' });
    addUser('jordan', { email: 'jordan@brightside.test', name: 'Jordan Reyes', title: 'Design Lead', team: 'Design', photo: '/photos/jordan.jpg' });
    addUser('sam', { email: 'sam@brightside.test', name: 'Sam Patel', title: 'Product Designer', team: 'Design', photo: '/photos/sam.jpg',
      quote: 'Hey Maya! I’m your person for anything, big or small. Nothing is too basic to ask. Let’s grab coffee on Tuesday and I’ll show you around.',
      ask: ['Figma tricks', 'Design crits', 'The café downstairs', 'Where things live'] });
    addUser('lena', { email: 'lena@brightside.test', name: 'Lena Ortiz', title: 'Co-founder', team: 'Leadership', photo: '/photos/lena.jpg' });
    addUser('dana', { email: 'dana@brightside.test', name: 'Dana Kim', title: 'Security Lead', team: 'IT', photo: '/photos/dana.jpg' });
    for (const [k, n, t] of [['analopez', 'Ana Lopez', 'Design Manager'], ['ben', 'Ben Kim', 'Senior Product Designer'], ['chloe', 'Chloe Wu', 'Content Designer'], ['diego', 'Diego Mora', 'Design Systems'], ['ellie', 'Ellie Hart', 'Researcher'], ['femi', 'Femi Nwosu', 'Product Designer']]) {
      addUser(k, { email: `${n.split(' ')[0].toLowerCase()}.${n.split(' ')[1].toLowerCase()}@brightside.test`, name: n, title: t, team: 'Design', photo: `/photos/${k === 'analopez' ? 'ana-lopez' : k}.jpg` });
    }
    // Journey + videos
    const j = Number(db.prepare('INSERT INTO journeys(org_id, name, edited_by, edited_at) VALUES (?,?,?,?)').run(org, 'Product Designer', U.priya, new Date(Date.now() - 2 * 864e5).toISOString()).lastInsertRowid);
    const addVideo = (o) => Number(db.prepare(
      'INSERT INTO videos(org_id,kind,title,presenter_id,duration_sec,status,still,chapters,caption,app_key,position,flagged,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    ).run(org, o.kind, o.title, o.by ? U[o.by] : null, o.sec || null, o.status || 'published', o.still || null, o.chapters ? JSON.stringify(o.chapters) : null,
      o.caption || null, o.app || null, o.pos || 0, o.flagged || 0, now()).lastInsertRowid);
    const V = {
      welcome: addVideo({ kind: 'intro', title: 'A hello from the whole team', by: 'lena', sec: 134, still: '/photos/video-welcome.jpg', caption: 'We’re so glad you said yes. Here’s what the next few weeks look like.' }),
      dayone: addVideo({ kind: 'intro', title: 'Welcome to week 1', by: 'jordan', sec: 130, still: '/photos/video-firstweek.jpg', caption: 'Monday is mostly about getting comfortable. No pressure to ship anything.' }),
      week: addVideo({ kind: 'intro', title: 'How your first week works', by: 'jordan', sec: 184, still: '/photos/video-firstweek.jpg', chapters: [[0, 'Welcome to week 1'], [46, 'How the week is set up'], [110, 'Your first small win']], caption: 'Every stage starts with a short video like this one.' }),
      stride: addVideo({ kind: 'intro', title: 'Days 30 to 90', by: 'sam', sec: 118, still: '/photos/video-hello-sam.jpg' }),
      founders: addVideo({ kind: 'intro', title: 'A message from the founders', by: 'lena', sec: 240, still: '/photos/video-welcome.jpg' }),
      phishing: addVideo({ kind: 'lesson', title: 'Spotting a phishing email', by: 'dana', sec: 372, still: '/photos/video-phishing.jpg', caption: 'First, check the sender’s real address, not just the name you see.' }),
      helloSam: addVideo({ kind: 'hello', title: 'Sam’s hello', by: 'sam', sec: 58, still: '/photos/video-hello-sam.jpg' }),
      helloJordan: addVideo({ kind: 'hello', title: 'Jordan’s hello', by: 'jordan', sec: 45, still: '/photos/video-firstweek.jpg' }),
      helloPriya: addVideo({ kind: 'hello', title: 'Priya’s hello', by: 'priya', sec: 62 }),
      helloDev: addVideo({ kind: 'hello', title: 'Dev’s hello', by: 'dev', sec: 38 }),
    };
    const app = (key, by, list) => list.forEach(([title, sec, chapters, caption, extra], i) => addVideo({ kind: 'app', app: key, title, by, sec, chapters, caption, pos: i + 1, ...(extra || {}) }));
    app('slack', 'dev', [
      ['Getting around Slack', 252, [[0, 'Your sidebar'], [70, 'Channels vs DMs'], [140, 'Threads'], [210, 'Status and focus']], 'Channels are for topics. DMs are for quick one-to-ones.'],
      ['Channels we use', 185], ['Threads and status', 160]]);
    app('notion', 'priya', [
      ['The fast way to find things', 305, [[0, 'The home page'], [80, 'Search, the fast way'], [160, 'Team spaces'], [240, 'Meeting notes']], 'Type a word, and search looks inside every page, not just titles.', { status: 'needs_update', flagged: 2 }],
      ['Team spaces and meeting notes', 210]]);
    app('linear', 'sam', [
      ['Your first week in Linear', 220, [[0, 'Your inbox'], [50, 'Issues and projects'], [110, 'Cycles'], [170, 'Picking up work']], 'Your inbox shows only what needs you. Everything else can wait.'],
      ['Issues and projects', 175], ['Cycles', 130], ['Linear for Engineering', null, null, null, { status: 'missing' }]]);
    // Stages
    const S = {};
    const addStage = (k, pos, name, emoji, tint, win, summary, startDay, endDay, intro) => {
      S[k] = Number(db.prepare('INSERT INTO stages(org_id,journey_id,position,name,emoji,tint,window,summary,start_day,end_day,intro_video_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(org, j, pos, name, emoji, tint, win, summary, startDay, endDay, intro).lastInsertRowid);
    };
    addStage('hello', 1, 'Hello!', '👋', 'butter', 'Offer accepted → Day 1', 'Get set up before Day 1: paperwork, your gear, and meeting your buddy.', -30, -1, V.welcome);
    addStage('dayone', 2, 'Day 1', '☀️', 'sky', 'Monday, first day', 'Your first day. Laptop on, logins working, lunch with {buddy}.', 0, 0, V.dayone);
    addStage('week', 3, 'Find Your Feet', '👟', 'peach', 'Days 1 to 5', 'Week 1. Short trainings, your tools, and a first small win.', 1, 5, V.week);
    addStage('stride', 4, 'Hit Your Stride', '🚀', 'sage', 'Days 30 to 90', 'Days 30 to 90. Real projects and regular check-ins with Jordan.', 30, 89, V.stride);
    addStage('did', 5, 'You Did It', '🎓', 'butter', 'Day 90', 'Graduation. Celebrate, share feedback, and maybe become someone’s buddy.', 90, 90, V.founders);
    const T = {};
    const task = (stage, key, type, title, meta, emoji, owner, due, ref = null) => {
      const pos = db.prepare('SELECT COALESCE(MAX(position),0)+1 p FROM task_templates WHERE stage_id = ?').get(S[stage]).p;
      T[key] = Number(db.prepare('INSERT INTO task_templates(org_id,stage_id,position,type,title,meta,emoji,owner_role,due_day,ref) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(org, S[stage], pos, type, title, meta, emoji, owner, due, ref).lastInsertRowid);
    };
    task('hello', 'welcome', 'video', 'Watch the welcome video', 'Video · A hello from the team · 2 min', '🎬', 'hire', -17, String(V.welcome));
    task('hello', 'photo', 'todo', 'Add a photo and your preferred name', 'Profile · 1 min', '🙂', 'hire', -14);
    task('hello', 'emergency', 'todo', 'Add emergency contacts', 'Form · 2 min · private', '📇', 'hire', -12, 'emergency');
    task('hello', 'w4', 'form', 'Fill in your W-4', 'Federal tax form · about 5 min · private to you and HR', '📝', 'hire', -9, 'w4');
    task('hello', 'deposit', 'todo', 'Set up direct deposit', 'Form · about 3 min', '🏦', 'hire', -7, 'direct_deposit');
    task('hello', 'handbook', 'sign', 'Read and sign the handbook', 'Read and sign · about 15 min', '✍️', 'hire', -5, 'handbook');
    task('hello', 'coffee', 'meeting', 'Book a coffee chat with {buddy}', 'Your buddy · 30 min', '☕', 'hire', -3);
    task('hello', 'i91', 'todo', 'Fill in I-9 Section 1', 'Form · by the end of Day 1', '🪪', 'hire', 0, 'i9-1');
    task('hello', 'bg', 'todo', 'Run background check', 'People Ops', '🔍', 'people_ops', -20);
    task('hello', 'offer', 'todo', 'Send offer letter for e-signature', 'People Ops', '📨', 'people_ops', -25);
    task('hello', 'laptop', 'it', 'Ship laptop', 'IT request · ships to their home', '💻', 'it', -10);
    task('hello', 'accounts', 'it', 'Create Google and Slack accounts', 'IT request', '🔑', 'it', -9);
    task('hello', 'figma', 'it', 'Create Figma seat', 'IT request', '🎨', 'it', 0);
    task('hello', 'plan', 'todo', 'Write the 30-60-90 plan', 'To-do · shared with them on Day 1', '🗺️', 'manager', -10);
    task('hello', 'book11', 'meeting', 'Book the first 1:1', 'Meeting · 45 min', '📅', 'manager', -7);
    task('hello', 'hellovid', 'todo', 'Record a hello video', 'Video · about a minute', '🎥', 'buddy', -6);
    task('hello', 'buddycoffee', 'meeting', 'Book a coffee chat', 'Meeting · 30 min', '☕', 'buddy', -4);
    task('dayone', 'i9', 'todo', 'I-9 document check', 'Form · within 3 business days of starting', '🪪', 'people_ops', 3, 'i9');
    task('dayone', 'notion', 'app', 'Tour of Notion', 'App walkthrough · 5 min', '📘', 'hire', 0, 'notion');
    task('dayone', 'first11', 'meeting', 'First 1:1 with your manager', 'Meeting · 45 min', '🤝', 'manager', 0);
    task('dayone', 'teamintro', 'meeting', 'Meet the Design team', 'Meeting · 30 min · 11:00', '👋', 'hire', 0);
    task('week', 'slack', 'app', 'How we talk in Slack', 'App walkthrough · 3 videos', '💬', 'hire', 1, 'slack');
    task('week', 'linear', 'app', 'How work moves in Linear', 'App walkthrough · 3 videos', '📐', 'hire', 2, 'linear');
    task('week', 'security', 'video', 'Security basics', 'Video lesson · 6 min · quick check', '🔒', 'hire', 3, String(V.phishing));
    task('week', 'win', 'todo', 'Ship a first small win', 'To-do · by Friday', '🏆', 'hire', 5);
    task('stride', 'd30', 'meeting', 'Day 30 check-in', 'Meeting · 30 min', '📍', 'manager', 30);
    task('stride', 'project', 'todo', 'Ship your first project', 'To-do', '🚀', 'hire', 45);
    task('stride', 'd60', 'meeting', 'Day 60 check-in', 'Meeting · 30 min', '📍', 'manager', 60);
    task('stride', 'buddy30', 'meeting', 'Buddy check-in', 'Meeting · 20 min', '☕', 'buddy', 30);
    task('stride', 'feedback', 'todo', 'Tell us how onboarding went', 'Survey · 3 min · anonymous option', '💬', 'hire', 60);
    task('stride', 'd90', 'meeting', 'Day 90 review', 'Meeting · 45 min', '🎯', 'manager', 89);
    task('did', 'survey', 'todo', 'Graduation survey', 'Survey · 3 min', '📝', 'hire', 90);
    task('did', 'cert', 'todo', 'Collect your certificate', 'To-do', '🎓', 'hire', 90);
    task('did', 'buddyup', 'todo', 'Become someone’s buddy', 'Optional', '🤝', 'hire', 90);
    // Quiz for the security lesson
    const q = (prompt, options, correct, explanation, hint, pos) => db.prepare('INSERT INTO quiz_questions(org_id,video_id,position,prompt,options,correct_index,explanation,wrong_hint) VALUES (?,?,?,?,?,?,?,?)')
      .run(org, V.phishing, pos, prompt, JSON.stringify(options), correct, explanation, hint);
    q('An email from “Jordan Reyes” asks you to buy gift cards for a client, today. What’s the biggest red flag?', ['It’s from Jordan. Managers don’t email about gift cards.', 'Gift cards plus “today.” Unusual request plus urgency is the classic combination.', 'It arrived before 9:00 AM.'], 1,
      'A strange request plus “today” is the classic scam combo. You’d forward this to IT and not reply.', 'Scammers often borrow a real name and send at normal hours. Look at what they’re asking for, and how fast.', 1);
    q('The sender shows as “Brightside IT” but the address is it-help@gmail.com. What do you do?', ['Reply and ask if it’s real.', 'Forward it to Dev in IT and delete it.', 'Click the link to check.'], 1,
      'Right. Real IT mail comes from @brightside.test. Forward anything odd to Dev.', 'Replying or clicking tells the sender your address works. Forward it instead.', 2);
    q('A login page looks exactly like Google’s. How can you tell if it’s real?', ['The logo looks right.', 'Check the address bar says accounts.google.com.', 'It asks for your password.'], 1,
      'Yes. Fake pages copy the look perfectly; the address bar can’t lie.', 'Fake pages copy logos and layouts perfectly. Look somewhere the scammer can’t control.', 3);
    // Connected apps (each company's own version of the standard template)
    const ca = (key, stage, roles, owner, tries, rules) => db.prepare('INSERT INTO connected_apps(org_id,app_key,stage_id,roles,try_items,house_rules,owner_id,connected_by,connected_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(org, key, S[stage], roles, JSON.stringify(tries), JSON.stringify(rules), U[owner], U.dev, now());
    ca('slack', 'week', 'All roles', 'dev', ['Join #design and #brightside-general', 'Add a profile photo and set your status', 'Say hi in #introductions'],
      [{ emoji: '🧵', title: 'Threads, always', body: 'Reply in the thread so channels stay easy to read.' }, { emoji: '⏱️', title: 'A day is fine', body: 'Nobody expects instant replies. If it’s urgent, call.' }, { emoji: '🔕', title: 'Focus time is real', body: 'When someone’s status says Focusing, wait or send it async.' }]);
    ca('notion', 'dayone', 'All roles', 'priya', ['Find the Design team page', 'Bookmark the Handbook', 'Add yourself to the team directory'],
      [{ emoji: '🔎', title: 'Search before you ask', body: 'Most answers are already written down somewhere.' }, { emoji: '📌', title: 'One home per topic', body: 'Link to a page instead of copying it.' }, { emoji: '✏️', title: 'Fix what’s wrong', body: 'Out of date? Edit it. Everyone can, and should.' }]);
    ca('linear', 'week', 'Design and Engineering', 'sam', ['Open the Design team’s current cycle', 'Find an issue labelled “good first issue”', 'Comment on it to say you’re picking it up'],
      [{ emoji: '🗓️', title: 'Cycles are 2 weeks', body: 'Work is planned in 2-week cycles that start on Mondays.' }, { emoji: '🏷️', title: 'Label everything', body: 'Every issue gets a team and a type, so nothing gets lost.' }, { emoji: '💬', title: 'Talk in the issue', body: 'Decisions go in the issue comments, not in DMs.' }]);
    // New hires
    const addHire = (key, name, title, team, photo, start, email) => {
      addUser(key, { email, name, title, team, photo, role: 'hire', start });
      db.prepare('UPDATE users SET manager_id = ?, buddy_id = ?, journey_id = ? WHERE id = ?').run(U.jordan, U.sam, j, U[key]);
      instantiateTasks(db, db.prepare('SELECT * FROM users WHERE id = ?').get(U[key]));
    };
    addHire('maya', 'Maya Chen', 'Product Designer', 'Design', '/photos/maya.jpg', mayaStart, 'maya@brightside.test');
    addHire('ana', 'Ana Ruiz', 'Account Executive', 'Sales', '/photos/ana-ruiz.jpg', addDays(todayIso(), -3), 'ana@brightside.test');
    addHire('theo', 'Theo Park', 'Software Engineer', 'Engineering', '/photos/theo.jpg', addDays(mayaStart, 7), 'theo@brightside.test');
    addHire('lina', 'Lina Haddad', 'Support Specialist', 'Support', '/photos/lina.jpg', addDays(mayaStart, 14), 'lina@brightside.test');
    const done = (hire, keys, byKey) => {
      for (const k of keys) db.prepare("UPDATE hire_tasks SET status = 'done', done_at = ?, done_by = ? WHERE hire_id = ? AND template_id = ?")
        .run(new Date(Date.now() - Math.random() * 6 * 864e5).toISOString(), byKey ? U[byKey] : U[hire], U[hire], T[k]);
    };
    done('maya', ['welcome', 'photo', 'emergency'], 'maya');
    done('maya', ['bg', 'offer'], 'priya'); done('maya', ['laptop', 'accounts'], 'dev'); done('maya', ['plan', 'book11'], 'jordan'); done('maya', ['hellovid', 'buddycoffee'], 'sam');
    db.prepare('INSERT INTO form_answers(hire_id,org_id,form_key,step,answers,updated_at) VALUES (?,?,?,?,?,?)').run(U.maya, org, 'w4', 2, JSON.stringify({ 1: 'single' }), now());
    done('ana', ['welcome', 'photo', 'emergency', 'w4', 'deposit', 'handbook', 'coffee', 'i91', 'notion', 'teamintro'], 'ana');
    done('ana', ['bg', 'offer'], 'priya'); done('ana', ['laptop', 'accounts', 'figma'], 'dev'); done('ana', ['plan', 'book11', 'first11'], 'jordan'); done('ana', ['hellovid', 'buddycoffee'], 'sam');
    done('theo', ['bg', 'offer'], 'priya'); done('theo', ['welcome'], 'theo');
    done('lina', ['offer'], 'priya');
    // Inbox + feelings
    const msg = (to, from, kind, title, body, link, action, hoursAgo) => db.prepare('INSERT INTO messages(org_id,user_id,from_id,kind,title,body,link,needs_action,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(org, U[to], from ? U[from] : null, kind, title, body, link, action ? 1 : 0, new Date(Date.now() - hoursAgo * 36e5).toISOString());
    msg('maya', 'priya', 'nudge', 'Your W-4 is due today', 'You’re halfway there. It takes about 4 more minutes.', '/today', 1, 2);
    msg('maya', 'dev', 'gear', 'Your laptop has shipped', 'It should arrive by Wednesday. Track it on Tools & access.', '/tools', 0, 20);
    msg('maya', 'jordan', 'note', 'A note from Jordan', 'So excited you’re joining. I’ve written your 30-60-90 plan; we’ll go through it together on Monday.', '/journey', 0, 30);
    msg('maya', 'sam', 'note', 'Coffee on Tuesday?', 'I booked us a table at the café downstairs at 10. My treat.', '/people', 0, 44);
    msg('maya', null, 'system', 'Welcome to Onboarding Buddy', 'Everything you need before Day 1, one step at a time.', '/welcome', 0, 72);
    msg('priya', 'dev', 'note', 'Linear for Engineering is still missing', 'Theo starts soon and the Engineering walkthrough isn’t recorded.', '/admin/apps/linear', 1, 5);
    db.prepare('INSERT INTO feelings(org_id,hire_id,value,created_at) VALUES (?,?,?,?)').run(org, U.maya, 4, now());
    db.prepare('INSERT INTO feelings(org_id,hire_id,value,created_at) VALUES (?,?,?,?)').run(org, U.ana, 5, now());
    return { org, users: U, mayaStart };
  });
}

// A second company, used by tests to prove one org can never see another's data.
export async function seedOtherOrg(db) {
  const pw = await hashPassword(SEED_PASSWORD);
  const org = Number(db.prepare('INSERT INTO orgs(name, slug, created_at) VALUES (?,?,?)').run('Northwind', 'northwind', now()).lastInsertRowid);
  db.prepare("INSERT INTO users(org_id,email,name,role,duty,password_hash,created_at) VALUES (?,?,?,?,?,?,?)").run(org, 'admin@northwind.test', 'Nora Admin', 'admin', 'people_ops', pw, now());
  return org;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const file = defaultDbPath();
  const ifEmpty = process.argv.includes('--if-empty');
  if (ifEmpty && fs.existsSync(file)) {
    const db = openDb(file);
    const n = db.prepare('SELECT COUNT(*) n FROM orgs').get().n;
    if (n > 0) { console.log('Data already there. Skipping seed.'); process.exit(0); }
  } else {
    for (const f of [file, file + '-wal', file + '-shm']) if (fs.existsSync(f)) fs.rmSync(f);
  }
  const db = openDb(file);
  const r = await seed(db);
  console.log(`Seeded Brightside. Maya starts ${r.mayaStart}. Password for every login: ${SEED_PASSWORD}`);
  console.log('Logins: maya@ (new hire) · priya@ (People Ops admin) · jordan@ (manager) · dev@ (IT) · sam@ (buddy)  — all @brightside.test');
}
