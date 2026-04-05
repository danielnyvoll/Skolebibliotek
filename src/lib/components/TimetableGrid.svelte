<script lang="ts">
  export interface TimetableEntry {
    id: number;
    weekday: number; // 1=Mon … 5=Fri
    start_time: string; // "08:00"
    end_time: string;   // "09:00"
    subject: string;
    title?: string | null;
    room?: string | null;
    notes?: string | null;
    color?: string | null;
  }

  interface Props {
    entries: TimetableEntry[];
    onDelete?: (id: number) => void;
  }

  let { entries, onDelete }: Props = $props();

  const DAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre'];
  const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 08–17

  function timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m ?? 0);
  }

  const GRID_START = 8 * 60; // 08:00 in minutes
  const GRID_END = 17 * 60;  // 17:00 in minutes
  const GRID_DURATION = GRID_END - GRID_START; // 540 min

  function topPct(entry: TimetableEntry): string {
    const start = timeToMinutes(entry.start_time);
    return (((start - GRID_START) / GRID_DURATION) * 100).toFixed(2) + '%';
  }

  function heightPct(entry: TimetableEntry): string {
    const start = timeToMinutes(entry.start_time);
    const end = timeToMinutes(entry.end_time);
    const h = Math.max(end - start, 15); // min 15 min height
    return ((h / GRID_DURATION) * 100).toFixed(2) + '%';
  }

  function entriesForDay(day: number): TimetableEntry[] {
    return entries.filter(e => e.weekday === day);
  }

  let tooltip = $state<{ entry: TimetableEntry; x: number; y: number } | null>(null);

  function showTooltip(e: MouseEvent, entry: TimetableEntry) {
    tooltip = { entry, x: e.clientX, y: e.clientY };
  }
  function hideTooltip() {
    tooltip = null;
  }
</script>

<div class="timetable-wrap">
  <!-- Hour labels -->
  <div class="time-col" aria-hidden="true">
    <div class="day-header-placeholder"></div>
    <div class="hours-track">
      {#each HOURS as h}
        <div class="hour-label" style="top: {(((h * 60 - GRID_START) / GRID_DURATION) * 100).toFixed(2)}%">
          {String(h).padStart(2, '0')}:00
        </div>
      {/each}
    </div>
  </div>

  <!-- Day columns -->
  {#each DAYS as dayName, i}
    {@const day = i + 1}
    <div class="day-col">
      <div class="day-header">{dayName}</div>
      <div class="day-track">
        <!-- hour lines -->
        {#each HOURS as h}
          <div
            class="hour-line"
            style="top: {(((h * 60 - GRID_START) / GRID_DURATION) * 100).toFixed(2)}%"
          ></div>
        {/each}

        <!-- entries -->
        {#each entriesForDay(day) as entry (entry.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="entry"
            style="
              top: {topPct(entry)};
              height: {heightPct(entry)};
              background: {entry.color ?? '#3b82f6'};
            "
            role="button"
            tabindex="0"
            onmouseenter={e => showTooltip(e, entry)}
            onmouseleave={hideTooltip}
            onfocus={e => showTooltip(e as unknown as MouseEvent, entry)}
            onblur={hideTooltip}
            aria-label="{entry.subject} {entry.start_time}–{entry.end_time}"
          >
            <span class="entry-subject">{entry.subject}</span>
            {#if entry.room}
              <span class="entry-room">{entry.room}</span>
            {/if}
            {#if onDelete}
              <button
                class="entry-delete"
                type="button"
                onclick={e => { e.stopPropagation(); onDelete?.(entry.id); }}
                aria-label="Slett"
              >×</button>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>

<!-- Tooltip (fixed, portaled via inline style) -->
{#if tooltip}
  <div
    class="tooltip"
    style="left: {tooltip.x + 12}px; top: {tooltip.y + 8}px;"
    role="tooltip"
  >
    <strong>{tooltip.entry.subject}</strong>
    <span>{tooltip.entry.start_time} – {tooltip.entry.end_time}</span>
    {#if tooltip.entry.title}<span>{tooltip.entry.title}</span>{/if}
    {#if tooltip.entry.room}<span>Rom: {tooltip.entry.room}</span>{/if}
    {#if tooltip.entry.notes}<span class="tooltip-notes">{tooltip.entry.notes}</span>{/if}
  </div>
{/if}

<style>
  .timetable-wrap {
    display: flex;
    gap: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: white;
    font-size: 0.8rem;
    min-width: 0;
  }

  .time-col {
    width: 44px;
    flex-shrink: 0;
    border-right: 1px solid var(--color-border);
    background: var(--color-bg-subtle);
  }

  .day-header-placeholder {
    height: 36px;
    border-bottom: 1px solid var(--color-border);
  }

  .hours-track {
    position: relative;
    height: 540px; /* 9 h × 60px */
  }

  .hour-label {
    position: absolute;
    right: 6px;
    transform: translateY(-50%);
    font-size: 0.7rem;
    color: var(--color-text-muted);
    white-space: nowrap;
    line-height: 1;
  }

  .day-col {
    flex: 1;
    min-width: 0;
    border-right: 1px solid var(--color-border);
  }
  .day-col:last-child {
    border-right: none;
  }

  .day-header {
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.8rem;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-subtle);
    color: var(--color-text-light);
  }

  .day-track {
    position: relative;
    height: 540px;
  }

  .hour-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--color-border);
    pointer-events: none;
  }

  .entry {
    position: absolute;
    left: 3px;
    right: 3px;
    border-radius: 5px;
    padding: 3px 5px;
    color: white;
    overflow: hidden;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 1px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    transition: filter 0.1s;
  }
  .entry:hover {
    filter: brightness(1.08);
    z-index: 10;
  }
  .entry:focus-visible {
    outline: 2px solid white;
    outline-offset: 1px;
    z-index: 10;
  }

  .entry-subject {
    font-weight: 600;
    font-size: 0.75rem;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .entry-room {
    font-size: 0.68rem;
    opacity: 0.85;
  }

  .entry-delete {
    position: absolute;
    top: 2px;
    right: 3px;
    background: rgba(0, 0, 0, 0.25);
    border: none;
    color: white;
    cursor: pointer;
    border-radius: 3px;
    width: 16px;
    height: 16px;
    font-size: 0.75rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .entry:hover .entry-delete,
  .entry:focus-within .entry-delete {
    opacity: 1;
  }

  .tooltip {
    position: fixed;
    z-index: 1000;
    background: #1e293b;
    color: white;
    border-radius: 8px;
    padding: 0.6rem 0.85rem;
    font-size: 0.8rem;
    max-width: 220px;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    pointer-events: none;
  }
  .tooltip strong {
    font-size: 0.85rem;
  }
  .tooltip-notes {
    margin-top: 0.2rem;
    font-style: italic;
    opacity: 0.8;
    font-size: 0.75rem;
  }
</style>
