import sql from '$lib/server/db';
import { json } from '@sveltejs/kit';

export async function GET({ url }) {
	try {
		const classId = Number(url.searchParams.get('classId'));
		if (!classId) {
			return json({ error: 'Missing classId' }, { status: 400 });
		}

		const events = await sql`
			select * from calendar_events where class_id = ${classId} order by date asc
		`;
		return json({ events });
	} catch (e) {
		console.error(e);
		return json({ error: 'Failed to fetch events' }, { status: 500 });
	}
}

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { class_id, date, time, type, title, agenda } = body;

		if (!class_id || !date || !type || !title) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const [result] = await sql`
			insert into calendar_events (class_id, date, time, type, title, agenda)
			values (${class_id}, ${date}, ${time}, ${type}, ${title}, ${agenda})
			returning *
		`;

		return json(result);
	} catch (e) {
		console.error(e);
		return json({ error: 'Failed to create event' }, { status: 500 });
	}
}
