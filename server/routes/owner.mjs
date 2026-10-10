// "My tasks" for anyone who owns tasks on other people's journeys: manager, IT, buddy, People Ops.
import { fail } from '../http.mjs';
import { hireTasks, person } from '../queries.mjs';

const frac = (list) => ({ done: list.filter((t) => t.status === 'done').length, total: list.length });

export default function registerOwner(router) {
  // Sidebar counts for whoever is signed in.
  router.get('/api/nav', ({ db, user }) => {
    if (!user) fail(401, 'Sign in to continue.');
    const unread = db.prepare('SELECT COUNT(*) n FROM messages WHERE org_id = ? AND user_id = ? AND read_at IS NULL').get(user.org_id, user.id).n;
    if (user.role === 'hire') {
      const mine = hireTasks(db, user).filter((t) => t.ownerRole === 'hire');
      return { unread, paperwork: frac(mine.filter((t) => ['form', 'sign'].includes(t.type) || ['emergency', 'direct_deposit', 'i9-1'].includes(t.ref))),
        training: frac(mine.filter((t) => ['video', 'app'].includes(t.type))), tools: frac(hireTasks(db, user).filter((t) => t.ownerRole === 'it' || t.type === 'app')) };
    }
    if (user.role === 'admin') {
      const hires = db.prepare("SELECT COUNT(*) n FROM users WHERE org_id = ? AND role = 'hire'").get(user.org_id).n;
      const missing = db.prepare("SELECT COUNT(*) n FROM videos WHERE org_id = ? AND status != 'published'").get(user.org_id).n;
      return { unread, hires, videosNeedingWork: missing };
    }
    const hires = db.prepare("SELECT * FROM users WHERE org_id = ? AND role = 'hire'").all(user.org_id);
    const open = hires.flatMap((h) => hireTasks(db, h)).filter((t) => t.ownerId === user.id && t.status !== 'done' && t.ownerRole !== 'hire').length;
    return { unread, open };
  });

  router.get('/api/my-tasks', ({ db, user }) => {
    if (!user) fail(401, 'Sign in to continue.');
    if (user.role === 'hire') fail(403, 'New hires see their tasks on Today.');
    const hires = db.prepare("SELECT * FROM users WHERE org_id = ? AND role = 'hire' ORDER BY start_date").all(user.org_id);
    const groups = [];
    for (const h of hires) {
      const mine = hireTasks(db, h).filter((t) => t.ownerId === user.id && t.ownerRole !== 'hire');
      if (mine.length) groups.push({ hire: { ...person(h), startDate: h.start_date }, tasks: mine });
    }
    const all = groups.flatMap((g) => g.tasks);
    return {
      me: { ...person(user), duty: user.duty },
      counts: { open: all.filter((t) => t.status !== 'done').length, overdue: all.filter((t) => t.overdue).length, dueToday: all.filter((t) => t.dueToday).length, done: all.filter((t) => t.status === 'done').length },
      groups,
    };
  });
}
