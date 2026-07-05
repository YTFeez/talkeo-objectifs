import db from './db.js';
import { logTodoAction } from './dailyLog.js';

const SAMPLE_TODOS = [
  {
    title: 'Ranger la chambre',
    description: 'Lit, bureau et sol',
    author: 'Maman',
    priority: 'normal',
    duration: 'normal',
    reward: 2.5,
    status: 'pending',
  },
  {
    title: 'Sortir le chien',
    description: 'Au moins 30 minutes de promenade',
    author: 'Papa',
    priority: 'high',
    duration: 'short',
    reward: 1.5,
    status: 'pending',
  },
  {
    title: 'Arroser les plantes',
    description: 'Salon et balcon',
    author: 'Maman',
    priority: 'low',
    duration: 'short',
    reward: 1,
    status: 'pending',
  },
  {
    title: 'Devoirs du soir',
    description: 'Maths et français',
    author: 'Maman',
    priority: 'high',
    duration: 'normal',
    reward: 3,
    status: 'done',
    completedDaysAgo: 1,
    createdDaysAgo: 3,
  },
  {
    title: 'Faire la vaisselle',
    description: 'Après le dîner',
    author: 'Papa',
    priority: 'normal',
    duration: 'short',
    reward: 1,
    status: 'done',
    completedDaysAgo: 2,
    createdDaysAgo: 5,
  },
  {
    title: 'Aider à préparer le dîner',
    description: 'Couper les légumes',
    author: 'Maman',
    priority: 'normal',
    duration: 'normal',
    reward: 2,
    status: 'done',
    completedDaysAgo: 5,
    createdDaysAgo: 7,
  },
  {
    title: 'Vider le lave-vaisselle',
    description: '',
    author: 'Papa',
    priority: 'low',
    duration: 'short',
    reward: 1,
    status: 'done',
    completedDaysAgo: 8,
    createdDaysAgo: 10,
  },
  {
    title: 'Nettoyer la salle de bain',
    description: 'Lavabo et miroir',
    author: 'Papa',
    priority: 'normal',
    duration: 'long',
    reward: 4,
    status: 'done',
    completedDaysAgo: 35,
    createdDaysAgo: 38,
  },
];

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export function seedDemoTodos() {
  let inserted = 0;

  const insert = db.prepare(`
    INSERT INTO todos (
      title, description, author, priority, duration, reward, status, created_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const sample of SAMPLE_TODOS) {
    const exists = db.prepare('SELECT id FROM todos WHERE title = ?').get(sample.title);
    if (exists) continue;

    const createdAt = sample.createdDaysAgo ? daysAgo(sample.createdDaysAgo) : daysAgo(1);
    const completedAt =
      sample.status === 'done' && sample.completedDaysAgo ? daysAgo(sample.completedDaysAgo) : null;

    const result = insert.run(
      sample.title,
      sample.description || '',
      sample.author,
      sample.priority,
      sample.duration,
      sample.reward,
      sample.status,
      createdAt,
      completedAt,
    );

    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
    logTodoAction(todo, 'created');
    if (todo.status === 'done') {
      logTodoAction(todo, 'completed');
    }
    inserted += 1;
  }

  return inserted;
}

export function seedTodosIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM todos').get();
  if (count > 0) return;
  seedDemoTodos();
}

seedTodosIfEmpty();
