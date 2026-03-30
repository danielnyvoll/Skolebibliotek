import sql from '$lib/server/db';
import { json } from '@sveltejs/kit';

export async function GET() {
	try {
		const classes = await sql`
			select id, name, grade, created_at from classes order by created_at desc
		`;
		return json({ classes });
	} catch (e) {
		console.error(e);
		return json({ error: 'Failed to fetch classes' }, { status: 500 });
	}
}

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { name, grade } = body;

		if (!name || !grade) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const [result] = await sql`
			insert into classes (name, grade) values (${name}, ${grade})
			returning id, name, grade, created_at
		`;

		return json(result);
	} catch (e) {
		console.error(e);
		return json({ error: 'Failed to create class' }, { status: 500 });
	}
}
