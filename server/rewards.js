import { db } from './db.js';

const badges = {
  spark: { name: 'Chispa Prisma', detail: 'Confirmaste tu primer reto y recibiste una pista para aprender.' },
  navigator: { name: 'Navegante de los Ecos', detail: 'Completaste los diez retos de tu primera expedición.' },
  horizon: { name: 'Horizonte Ascendente', detail: 'Superaste tu mejor nota anterior en esta evaluación.' }
};
const badgeView = row => ({ code: row.code, ...badges[row.code] });

// Called only within confirmAnswer's transaction. Unique keys also defend retries.
function grant(run, event, xp, badgeCodes = []) {
  db.prepare('INSERT OR IGNORE INTO reward_events (expedition_id,event,xp) VALUES (?,?,?)').run(run.id, event, xp);
  const earned = [];
  for (const code of badgeCodes) {
    const result = db.prepare('INSERT OR IGNORE INTO earned_badges (user_id,code,expedition_id) VALUES (?,?,?)').run(run.user_id, code, run.id);
    if (result.changes) earned.push(badgeView({ code }));
  }
  return earned;
}

export function rewardAnswer(run, questionId, correct) {
  const xp = correct ? 10 : 5;
  const earned = grant(run, `answer:${questionId}`, xp, ['spark']);
  return { xp, learning: 5, accuracy: correct ? 5 : 0, completion: 0, improvement: 0, badges: earned };
}

export function rewardCompletion(run, result, reward) {
  const previous = db.prepare('SELECT MAX(score_percent) AS best FROM attempts WHERE user_id = ? AND assessment_id = ? AND id != ?').get(run.user_id, run.assessment_id, result.id).best;
  const improved = previous !== null && result.score > previous;
  const earned = grant(run, 'completion', 30, ['navigator']);
  if (improved) earned.push(...grant(run, 'improvement', 20, ['horizon']));
  reward.completion = 30;
  reward.improvement = improved ? 20 : 0;
  reward.xp += 30 + reward.improvement;
  reward.badges.push(...earned);
}

export function runRewards(id) {
  const events = db.prepare('SELECT event,xp FROM reward_events WHERE expedition_id = ? ORDER BY rowid').all(id);
  const confirmed = events.filter(e => e.event.startsWith('answer:'));
  return {
    xp: events.reduce((sum,e) => sum + e.xp, 0),
    learning: confirmed.length * 5,
    accuracy: confirmed.reduce((sum,e) => sum + e.xp - 5, 0),
    completion: events.find(e => e.event === 'completion')?.xp || 0,
    improvement: events.find(e => e.event === 'improvement')?.xp || 0,
    badges: db.prepare('SELECT code FROM earned_badges WHERE expedition_id = ? ORDER BY rowid').all(id).map(badgeView)
  };
}

export function rewardProfile(userId) {
  return {
    xp: db.prepare('SELECT COALESCE(SUM(r.xp),0) AS xp FROM reward_events r JOIN expeditions e ON e.id=r.expedition_id WHERE e.user_id=?').get(userId).xp,
    badges: db.prepare('SELECT code FROM earned_badges WHERE user_id = ? ORDER BY rowid').all(userId).map(badgeView)
  };
}
