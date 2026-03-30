export interface ClassProfile {
	id: number;
	name: string;
	grade: 1 | 2 | 3 | 4;
	created_at?: string;
}

export interface CurriculumNote {
	id?: number;
	class_id: number;
	week_start: string;
	notes: string;
}

export interface WeeklyPlan {
	id?: number;
	class_id: number;
	week_start: string;
	plan_md: string;
	updated_at?: string;
}

export interface CalendarEvent {
	id?: number;
	class_id: number;
	date: string;
	time?: string;
	type: 'ferie' | 'elevsamtale' | 'foreldremøte';
	title: string;
	agenda?: string;
}

export interface DocumentItem {
	id: number;
	title: string;
	collection: string;
	grade: 1 | 2 | 3 | 4;
	language: string;
	tags: string[];
	content: string;
	created_at: string;
}
