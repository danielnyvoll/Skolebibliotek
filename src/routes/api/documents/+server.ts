import sql from '$lib/server/db';
import { json } from '@sveltejs/kit';

export async function GET() {
	try {
		const documents = await sql`
			select id, title, collection, grade, language, tags, created_at
			from documents
			order by created_at desc
		`;
		return json({ documents });
	} catch (e) {
		console.error(e);
		return json({ error: 'Failed to fetch documents' }, { status: 500 });
	}
}

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { title, collection, grade, language, tags, content } = body;

		if (!title || !collection || !grade || !content) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const tagsArray = tags ? tags.split(',').map((t: string) => t.trim()).filter((t: string) => t) : [];

		const [result] = await sql`
			insert into documents (title, collection, grade, language, tags, content)
			values (${title}, ${collection}, ${grade}, ${language || 'norsk'}, ${JSON.stringify(tagsArray)}, ${content})
			returning id, title, collection, grade, language, tags, created_at
		`;

		return json(result);
	} catch (e) {
		console.error(e);
		return json({ error: 'Failed to create document' }, { status: 500 });
	}
}
