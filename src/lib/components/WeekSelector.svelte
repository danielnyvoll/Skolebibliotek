<script lang="ts">
	interface Props {
		weekStart: string;
		onWeekChange: (weekStart: string) => void;
	}

	let { weekStart, onWeekChange }: Props = $props();

	function getWeekNumber(date: Date): number {
		const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
		const dayNum = d.getUTCDay() || 7;
		d.setUTCDate(d.getUTCDate() + 4 - dayNum);
		const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
		return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	}

	function getMondayOfWeek(dateStr: string): string {
		const date = new Date(dateStr);
		const day = date.getDay();
		const diff = date.getDate() - day + (day === 0 ? -6 : 1);
		const monday = new Date(date.setDate(diff));
		return monday.toISOString().split('T')[0];
	}

	function addDays(dateStr: string, days: number): string {
		const date = new Date(dateStr);
		date.setDate(date.getDate() + days);
		return date.toISOString().split('T')[0];
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' });
	}

	function goToPreviousWeek() {
		const prevWeek = addDays(weekStart, -7);
		onWeekChange(prevWeek);
	}

	function goToNextWeek() {
		const nextWeek = addDays(weekStart, 7);
		onWeekChange(nextWeek);
	}

	const weekNum = $derived(getWeekNumber(new Date(weekStart + 'T00:00:00')));
	const weekDisplay = $derived(`Uke ${weekNum} – ${formatDate(weekStart)}`);
</script>

<div class="form-group">
	<label>Velg uke</label>
	<div style="display: flex; gap: var(--spacing-md); align-items: center;">
		<button type="button" class="button-secondary" onclick={goToPreviousWeek}>← Forrige</button>
		<span style="font-weight: 600; min-width: 200px; text-align: center;">{weekDisplay}</span>
		<button type="button" class="button-secondary" onclick={goToNextWeek}>Neste →</button>
	</div>
</div>
