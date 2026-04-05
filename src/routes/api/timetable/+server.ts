import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';

/**
 * GET /api/timetable?class_id=1&week_start=2024-01-08
 * Returns all timetable entries for a class × week.
 */
export const GET: RequestHandler = async ({ url }) => {
  const classId = url.searchParams.get('class_id');
  const weekStart = url.searchParams.get('week_start');

  if (!classId || !weekStart) {
    throw error(400, 'class_id and week_start are required');
  }

  const rows = await db`
    SELECT id, class_id, week_start, weekday, start_time, end_time,
           subject, title, room, notes, color, created_at, updated_at
    FROM timetable_entries
    WHERE class_id = ${parseInt(classId, 10)}
      AND week_start = ${weekStart}
    ORDER BY weekday, start_time
  `;

  return json(rows);
};

/**
 * POST /api/timetable
 * Body: { class_id, week_start, weekday, start_time, end_time, subject, title?, room?, notes?, color? }
 * Creates a new entry. Returns the created row.
 */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { class_id, week_start, weekday, start_time, end_time, subject } = body;

  if (!class_id || !week_start || !weekday || !start_time || !end_time || !subject) {
    throw error(400, 'class_id, week_start, weekday, start_time, end_time and subject are required');
  }

  const [row] = await db`
    INSERT INTO timetable_entries
      (class_id, week_start, weekday, start_time, end_time, subject, title, room, notes, color)
    VALUES (
      ${class_id},
      ${week_start},
      ${weekday},
      ${start_time},
      ${end_time},
      ${subject},
      ${body.title ?? null},
      ${body.room ?? null},
      ${body.notes ?? null},
      ${body.color ?? '#3b82f6'}
    )
    RETURNING *
  `;

  return json(row, { status: 201 });
};

/**
 * DELETE /api/timetable?id=42
 * Deletes a single entry by id.
 */
export const DELETE: RequestHandler = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) throw error(400, 'id is required');

  await db`DELETE FROM timetable_entries WHERE id = ${parseInt(id, 10)}`;
  return json({ ok: true });
};
