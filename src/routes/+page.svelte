<script lang="ts">
  import { onMount } from 'svelte';
  import pb from '$lib/pocketbase';

  let currentDate = $state('');
  let lastWorkouts: Record<string, any[]> = $state({});

  $effect(() => {
    const now = new Date();
    currentDate = now.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
  });

  onMount(async () => {
    try {
      const types = ['push', 'pull', 'legs', 'full'];
      for (const t of types) {
        const workouts = await pb.collection('workouts').getFullList({
          filter: `muscle_group = "${t}"`,
          sort: '-date',
          perPage: 1,
        });
        if (workouts.length > 0) {
          const w = workouts[0];
          const we = await pb.collection('workout_exercises').getFullList({
            filter: `workout = "${w.id}"`,
            sort: 'order',
            expand: 'exercise',
          });
          lastWorkouts[t] = we.map((e: any) => ({
            id: e.expand?.exercise?.id,
            name: e.expand?.exercise?.name || 'Inconnu',
          }));
        }
      }
    } catch (e) { console.error(e); }
  });

  function quickStart(type: string) {
    if (!lastWorkouts[type]?.length) {
      window.location.href = '/gym';
      return;
    }
    const data = encodeURIComponent(JSON.stringify({ type, exercises: lastWorkouts[type] }));
    window.location.href = `/gym?quick=${data}`;
  }
async function logSleep() {
  const now = new Date();
  const time = now.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
  const today = now.toISOString().split('T')[0];

  try {
    const records = await pb.collection('checkins').getFullList({ filter: `date = "${today}"` });
    if (records.length > 0) {
      await pb.collection('checkins').update(records[0].id, { sleep_time: time });
    } else {
      await pb.collection('checkins').create({ date: today, sleep_time: time });
    }
    alert('Bonne nuit ! 🌙');
  } catch (e) { console.error(e); }
}

async function logWake() {
  const now = new Date();
  const time = now.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
  const today = now.toISOString().split('T')[0];

  try {
    const records = await pb.collection('checkins').getFullList({ filter: `date = "${today}"` });
    if (records.length > 0) {
      await pb.collection('checkins').update(records[0].id, { wake_time: time });
    } else {
      await pb.collection('checkins').create({ date: today, wake_time: time });
    }
    alert('Bonjour ! ☀️');
  } catch (e) { console.error(e); }
}
</script>

<div>
  <div style="margin-bottom: 24px;">
    <p style="color: #595959; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Aujourd'hui</p>
    <h1 style="font-size: 20px; font-weight: 500; color: #F5F5F5; margin-top: 2px; text-transform: capitalize;">{currentDate}</h1>
  </div>

  <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
    <p style="color: #595959; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">💡 Flash</p>
    <p style="color: #F5F5F5; line-height: 1.6;">Bienvenue sur OS-PERSO. Ta dernière séance est prête à être relancée.</p>
  </div>

  <div style="margin-bottom: 24px;">
    <p style="color: #595959; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Démarrer une séance</p>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
      {#each ['push', 'pull', 'legs', 'full'] as type}
        {@const label = { push: 'Push', pull: 'Pull', legs: 'Legs', full: 'Full' }[type]}
        <button onclick={() => quickStart(type)}
          style="padding: 14px; background: #141414; border: 1px solid #262626; border-radius: 8px; color: #F5F5F5; font-size: 14px; font-weight: 500; cursor: pointer; text-align: left;">
          {label}
          {#if lastWorkouts[type]?.length}
            <span style="display: block; color: #595959; font-size: 11px; font-weight: 400; margin-top: 2px;">
              {lastWorkouts[type].length} exercices
            </span>
          {:else}
            <span style="display: block; color: #595959; font-size: 11px; font-weight: 400; margin-top: 2px;">Aucune séance</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>

<div style="margin-bottom: 24px;">
  <p style="color: #595959; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Aujourd'hui</p>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
    <button onclick={logWake}
      style="padding: 12px; background: #141414; border: 1px solid #262626; border-radius: 8px; color: #F5F5F5; font-size: 14px; cursor: pointer;">
      ☀️ Je me réveille
    </button>
    <button onclick={logSleep}
      style="padding: 12px; background: #141414; border: 1px solid #262626; border-radius: 8px; color: #F5F5F5; font-size: 14px; cursor: pointer;">
      🌙 Je me couche
    </button>
  </div>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
    <a href="/gym" style="text-decoration: none;">
      <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; align-items: center; gap: 6px;">
        <span style="font-size: 20px;">🏋️</span>
        <span style="color: #595959; font-size: 11px;">Gym</span>
      </div>
    </a>
    <a href="/deen" style="text-decoration: none;">
      <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; align-items: center; gap: 6px;">
        <span style="font-size: 20px;">🕌</span>
        <span style="color: #595959; font-size: 11px;">Deen</span>
      </div>
    </a>
    <a href="/perso" style="text-decoration: none;">
      <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; align-items: center; gap: 6px;">
        <span style="font-size: 20px;">🧠</span>
        <span style="color: #595959; font-size: 11px;">Perso</span>
      </div>
    </a>
  </div>
</div>

  <div style="margin-bottom: 24px;">
    <p style="color: #595959; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Activité récente</p>
    <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 20px;">
      <p style="color: #595959; font-size: 14px; text-align: center;">Bientôt connecté à tes modules.</p>
    </div>
  </div>
</div>