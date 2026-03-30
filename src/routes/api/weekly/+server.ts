import sql from '$lib/server/db';
import { json } from '@sveltejs/kit';

export async function GET({ url }) {
  const classId = Number(url.searchParams.get('classId'));
  const weekStart = url.searchParams.get('weekStart'); // "YYYY-MM-DD"
  const [notes] = await sql`
    select * from curriculum_notes where class_id=${classId} and week_start=${weekStart}
  `;
  const [plan] = await sql`
    select * from weekly_plans where class_id=${classId} and week_start=${weekStart}
  `;
  return json({ notes: notes ?? null, plan: plan ?? null });
}

export async function POST({ request }) {
  const b = await request.json(); // {class_id, week_start, notes, plan_md}
  if (b.notes) {
    await sql`
      insert into curriculum_notes (class_id, week_start, notes)
      values (${b.class_id}, ${b.week_start}, ${b.notes})
      on conflict (class_id, week_start) do update set notes=excluded.notes
    `;
  }
  if (b.plan_md !== undefined) {
    await sql`
      insert into weekly_plans (class_id, week_start, plan_md)
      values (${b.class_id}, ${b.week_start}, ${b.plan_md})
      on conflict (class_id, week_start) do update set
        plan_md=excluded.plan_md, updated_at=now()
    `;
  }
  return json({ ok: true });
}