<script lang="ts">
	interface Props {
		message: string;
		type: 'success' | 'error';
		onDismiss?: () => void;
	}

	let { message, type, onDismiss }: Props = $props();

	let visible = $state(true);

	$effect(() => {
		if (message && onDismiss) {
			const timer = setTimeout(() => {
				visible = false;
				onDismiss?.();
			}, 3000);
			return () => clearTimeout(timer);
		}
	});

</script>

{#if visible}
<div class="feedback {type}">
	{message}
	{#if onDismiss}
		<button
			type="button"
			onclick={() => {
				visible = false;
				onDismiss?.();
			}}
			style="background: none; color: inherit; border: none; cursor: pointer; margin-left: var(--spacing-sm); text-decoration: underline; padding: 0;"
		>
			✕
		</button>
	{/if}
</div>
{/if}
