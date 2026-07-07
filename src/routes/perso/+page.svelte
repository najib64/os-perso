<script lang="ts">
  import { onMount } from 'svelte';
  import pb from '$lib/pocketbase';

  let checkins: any[] = $state([]);
  let loading = $state(true);
  let todayCheckin: any = $state(null);

  let showForm = $state(false);
  let sleepTime = $state('23:00');
  let wakeTime = $state('07:00');
  let sleepQuality = $state(3);
  let energyMorning = $state(3);
  let energyEvening = $state(3);
  let mood = $state(3);
  let screenTime = $state('');
  let notes = $state('');
  let saving = $state(false);

  let coldShower = $state(false);
  let teethBrushed = $state(false);
  let news = $state(false);
  let stretched = $state(false);
  let noDoomscroll = $state(false);
  let editingCheckin: any = $state(null);

  let selectedDay: any = $state(null);

  const today = new Date().toISOString().split('T')[0];

  onMount(() => { setTimeout(() => loadCheckins(), 300); });

  let currentDay = $state(today);

  $effect(() => {
    const timer = setInterval(() => {
      const newDay = new Date().toISOString().split('T')[0];
      if (newDay !== currentDay) {
        currentDay = newDay;
        todayCheckin = null;
        coldShower = false;
        teethBrushed = false;
        news = false;
        stretched = false;
        noDoomscroll = false;
        sleepTime = '23:00';
        wakeTime = '07:00';
        sleepQuality = 3;
        energyMorning = 3;
        energyEvening = 3;
        mood = 3;
        screenTime = '';
        notes = '';
        loadCheckins();
      }
    }, 30000);
    return () => clearInterval(timer);
  });

  async function loadCheckins() {
    loading = true;
    try {
      const records = await pb.collection('checkins').getFullList({ sort: '-date' });
      checkins = records;
    todayCheckin = records.find((c: any) => c.date && c.date.startsWith(today)) || null;
    dayScore = calcDayScore(todayCheckin);
    console.log('todayCheckin après load:', todayCheckin ? 'trouvé' : 'null');
      if (todayCheckin) {
        sleepTime = todayCheckin.sleep_time || '23:00';
        wakeTime = todayCheckin.wake_time || '07:00';
        sleepQuality = todayCheckin.sleep_quality || 3;
        energyMorning = todayCheckin.energy_morning || 3;
        energyEvening = todayCheckin.energy_evening || 3;
        mood = todayCheckin.mood || 3;
        screenTime = todayCheckin.screen_time || '';
        notes = todayCheckin.notes || '';
        coldShower = todayCheckin.cold_shower === 1;
        teethBrushed = todayCheckin.teeth_brushed === 1;
        news = todayCheckin.news === 1;
        stretched = todayCheckin.stretched === 1;
        noDoomscroll = todayCheckin.no_doomscroll === 1;
      }
    } catch (e) { console.error(e); }
    loading = false;
  }

  function calcSleepHours(st: string, wt: string): number | null {
    if (!st || !wt) return null;
    const [sh, sm] = st.split(':').map(Number);
    const [wh, wm] = wt.split(':').map(Number);
    let sleep = wh * 60 + wm - (sh * 60 + sm);
    if (sleep < 0) sleep += 24 * 60;
    return Math.round((sleep / 60) * 10) / 10;
  }

  let sleepHours = $derived(calcSleepHours(sleepTime, wakeTime));

  function moodEmoji(v: number) {
    const emojis = ['😞', '😕', '😐', '🙂', '😄'];
    return emojis[v - 1] || '😐';
  }

  async function deleteCheckin(checkin: any) {
    if (!confirm('Supprimer ce check-in ?')) return;
    try {
      await pb.collection('checkins').delete(checkin.id);
      await loadCheckins();
    } catch (e) { console.error(e); }
  }

async function saveCheckin() {
  saving = true;
  const data: any = {
    sleep_time: sleepTime, wake_time: wakeTime,
    sleep_quality: sleepQuality, energy_morning: energyMorning,
    energy_evening: energyEvening, mood: mood,
    screen_time: screenTime ? parseInt(screenTime) : null, notes: notes,
    cold_shower: coldShower ? 1 : 0, teeth_brushed: teethBrushed ? 1 : 0,
    news: news ? 1 : 0, stretched: stretched ? 1 : 0,
    no_doomscroll: noDoomscroll ? 1 : 0,
  };
  try {
    if (editingCheckin?.id) {
      await pb.collection('checkins').update(editingCheckin.id, data);
    } else if (todayCheckin?.id) {
      await pb.collection('checkins').update(todayCheckin.id, data);
    } else {
      data.date = today;
      const created = await pb.collection('checkins').create(data);
      todayCheckin = created;
    }

    showForm = false;
    editingCheckin = null;
    await loadCheckins();
  } catch (e) { console.error(e); }
  saving = false;
}
  async function toggleTracker(field: string) {
    if (field === 'cold_shower') coldShower = !coldShower;
    if (field === 'teeth_brushed') teethBrushed = !teethBrushed;
    if (field === 'news') news = !news;
    if (field === 'stretched') stretched = !stretched;
    if (field === 'no_doomscroll') noDoomscroll = !noDoomscroll;

    const value = field === 'cold_shower' ? coldShower :
                 field === 'teeth_brushed' ? teethBrushed :
                 field === 'news' ? news :
                 field === 'stretched' ? stretched : noDoomscroll;

    if (todayCheckin) {
      todayCheckin[field] = value ? 1 : 0;
      dayScore = calcDayScore(todayCheckin);
    }

    try {
      const existing = await pb.collection('checkins').getFullList({ filter: `date = "${today}"` });
      if (existing.length > 0) {
        const data: any = {};
        data[field] = value ? 1 : 0;
        await pb.collection('checkins').update(existing[0].id, data);
      }
    } catch (e) { console.error(e); }
  }

let dayScore: number | null = $state(null);

function calcDayScore(checkin: any) {
  if (!checkin) return null;
  let score = 0;
  const sh = calcSleepHours(checkin.sleep_time, checkin.wake_time) || 0;
  if (sh >= 8) score += 20;
  else if (sh >= 7) score += 16;
  else if (sh >= 6) score += 10;
  else if (sh >= 5) score += 5;
  score += (checkin.sleep_quality || 0) * 2;
  score += ((checkin.energy_morning || 3) + (checkin.energy_evening || 3)) / 2 * 3;
  score += (checkin.mood || 3) * 3;
  const st = checkin.screen_time || 999;
  if (st <= 60) score += 15;
  else if (st <= 120) score += 10;
  else if (st <= 180) score += 5;
  if (checkin.cold_shower) score += 5;
  if (checkin.teeth_brushed) score += 3;
  if (checkin.news) score += 5;
  if (checkin.stretched) score += 3;
  if (checkin.no_doomscroll) score += 5;
  return Math.min(100, score);
}
let avgSleep = $derived(
  (() => {
    const data = checkins.slice(0, 7).map((c: any) => calcSleepHours(c.sleep_time, c.wake_time)).filter(Boolean) as number[];
    if (data.length === 0) return null;
    return Math.round((data.reduce((a, b) => a + b, 0) / data.length) * 10) / 10;
  })()
);

let avgScreen = $derived(
  (() => {
    const data = checkins.slice(0, 7).map((c: any) => c.screen_time).filter((v: any) => v != null) as number[];
    if (data.length === 0) return null;
    return Math.round(data.reduce((a, b) => a + b, 0) / data.length);
  })()
);
  function scoreColor(s: number): string {
    if (s >= 80) return '#22C55E';
    if (s >= 60) return '#4ADE80';
    if (s >= 45) return '#F59E0B';
    if (s >= 30) return '#F97316';
    return '#EF4444';
  }

  function scoreLabel(s: number): string {
    if (s >= 85) return 'Excellent';
    if (s >= 70) return 'Très bien';
    if (s >= 55) return 'Bien';
    if (s >= 40) return 'Moyen';
    if (s >= 25) return 'Faible';
    return 'À améliorer';
  }

  const trackers = [
    { key: 'cold_shower', icon: '🚿', label: 'Douche froide', value: coldShower },
    { key: 'teeth_brushed', icon: '🪥', label: 'Dents brossées', value: teethBrushed },
    { key: 'news', icon: '📰', label: 'Actualités lues', value: news },
    { key: 'stretched', icon: '🧘', label: 'Étirements', value: stretched },
    { key: 'no_doomscroll', icon: '🚫', label: 'Zéro doomscroll', value: noDoomscroll },
  ];

  function openDayDetail(checkin: any) {
    selectedDay = checkin;
  }

  function closeDayDetail() {
    selectedDay = null;
  }
function dayDetailSleep(c: any) {
  return calcSleepHours(c.sleep_time, c.wake_time);
}
function editCheckin(checkin: any) {
  sleepTime = checkin.sleep_time || '23:00';
  wakeTime = checkin.wake_time || '07:00';
  sleepQuality = checkin.sleep_quality || 3;
  energyMorning = checkin.energy_morning || 3;
  energyEvening = checkin.energy_evening || 3;
  mood = checkin.mood || 3;
  screenTime = checkin.screen_time || '';
  notes = checkin.notes || '';
  coldShower = checkin.cold_shower === 1;
  teethBrushed = checkin.teeth_brushed === 1;
  news = checkin.news === 1;
  stretched = checkin.stretched === 1;
  noDoomscroll = checkin.no_doomscroll === 1;
  showForm = true;
}
</script>

<div>
  <div style="margin-bottom: 20px;">
    <p style="color: #595959; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Perso</p>
    <h1 style="font-size: 20px; font-weight: 500; color: #F5F5F5; margin-top: 2px;">Score & Habitudes</h1>
  </div>

{#if dayScore != null}
  <div style="background: linear-gradient(135deg, #141414 0%, #1A1A1A 100%); border: 1px solid #262626; border-radius: 16px; padding: 24px; margin-bottom: 20px; text-align: center; position: relative; overflow: hidden;">
    <div style="position: absolute; top: -40px; right: -40px; width: 120px; height: 120px; border-radius: 50%; background: {scoreColor(dayScore)}; opacity: 0.08;"></div>
    <div style="position: absolute; bottom: -20px; left: -20px; width: 80px; height: 80px; border-radius: 50%; background: {scoreColor(dayScore)}; opacity: 0.05;"></div>
    <p style="color: #8C8C8C; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; position: relative;">Score du jour</p>
    <div style="position: relative; display: inline-block;">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="60" fill="none" stroke="#262626" stroke-width="8" />
        <circle cx="70" cy="70" r="60" fill="none" stroke={scoreColor(dayScore)} stroke-width="8"
          stroke-dasharray="{(dayScore / 100) * 377} 377"
          stroke-linecap="round" transform="rotate(-90 70 70)" />
      </svg>
      <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <span style="font-size: 38px; font-weight: 500; color: #F5F5F5; line-height: 1;">{dayScore}</span>
        <span style="font-size: 11px; color: {scoreColor(dayScore)}; font-weight: 500; margin-top: 2px;">{scoreLabel(dayScore)}</span>
      </div>
    </div>
  </div>
{:else}
  <div style="background: linear-gradient(135deg, #141414 0%, #1A1A1A 100%); border: 1px solid #262626; border-radius: 16px; padding: 24px; margin-bottom: 20px; text-align: center; position: relative; overflow: hidden;">
    <p style="color: #8C8C8C; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">Score du jour</p>
    <div style="position: relative; display: inline-block;">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="60" fill="none" stroke="#262626" stroke-width="8" />
      </svg>
      <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <span style="font-size: 24px; font-weight: 500; color: #595959;">--</span>
        <span style="font-size: 11px; color: #595959; margin-top: 2px;">En attente</span>
      </div>
    </div>
  </div>
{/if}

  <div style="margin-bottom: 20px;">
    <p style="color: #595959; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px;">Trackers du jour</p>
    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
      {#each trackers as t}
        <button onclick={() => toggleTracker(t.key)}
          style="display: flex; align-items: center; gap: 6px; padding: 10px 14px; border-radius: 10px; border: 1px solid #262626; background: {t.value ? '#1A2A1A' : '#141414'}; cursor: pointer;"
        >
          <span style="font-size: 16px;">{t.icon}</span>
          <span style="font-size: 11px; color: {t.value ? '#22C55E' : '#595959'}; font-weight: {t.value ? '500' : '400'};">
            {t.label}
          </span>
        </button>
      {/each}
    </div>
  </div>

  <div style="margin-bottom: 20px;">
    <p style="color: #595959; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px;">Aujourd'hui</p>
    {#if todayCheckin}
      <div style="background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 14px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; text-align: center; margin-bottom: 10px;">
          <div>
            <p style="color: #595959; font-size: 10px;">😴 Sommeil</p>
            <p style="color: #F5F5F5; font-size: 15px; font-weight: 500;">{sleepHours || '--'}h</p>
          </div>
          <div>
            <p style="color: #595959; font-size: 10px;">⚡ Énergie</p>
            <p style="color: #F5F5F5; font-size: 15px; font-weight: 500;">{todayCheckin.energy_morning || '--'}/{todayCheckin.energy_evening || '--'}</p>
          </div>
          <div>
            <p style="color: #595959; font-size: 10px;">😊 Humeur</p>
            <p style="font-size: 18px;">{moodEmoji(todayCheckin.mood)}</p>
          </div>
        </div>
        <button onclick={() => showForm = true}
          style="width: 100%; padding: 8px; background: transparent; border: 1px solid #262626; border-radius: 6px; color: #8C8C8C; font-size: 12px; cursor: pointer;">
          ✏️ Compléter le check-in
        </button>
      </div>
    {:else}
      <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 16px; text-align: center;">
        <p style="color: #8C8C8C; font-size: 13px; margin-bottom: 10px;">Pas encore de check-in aujourd'hui.</p>
        <button onclick={() => showForm = true}
          style="background: #3B82F6; color: white; border: none; border-radius: 6px; padding: 10px 20px; font-size: 13px; cursor: pointer;">
          Faire mon check-in
        </button>
      </div>
    {/if}
  </div>

  <div style="margin-bottom: 20px;">
    <p style="color: #595959; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px;">7 derniers jours</p>
    <div style="background: #141414; border: 1px solid #262626; border-radius: 10px; overflow: hidden;">
      {#if checkins.length > 0}
        {#each checkins.slice(0, 7).reverse() as c, index}
          {@const sh = calcSleepHours(c.sleep_time, c.wake_time)}
          {@const dayLabel = new Date(c.date).toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric' })}
          <div onclick={() => openDayDetail(c)} role="button" tabindex="0" onkeydown={(e: any) => e.key === 'Enter' && openDayDetail(c)}
            style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; border-bottom: {index < Math.min(checkins.length, 7) - 1 ? '1px solid #262626' : 'none'};">
            <span style="color: #8C8C8C; font-size: 11px; min-width: 52px;">{dayLabel}</span>
            <span style="color: #F5F5F5; font-size: 12px; min-width: 32px;">{sh ? sh + 'h' : '--'}</span>
            <span style="font-size: 13px;">{moodEmoji(c.mood || 0)}</span>
            <span style="color: {c.mood >= 4 ? '#22C55E' : c.mood >= 3 ? '#F59E0B' : '#EF4444'}; font-size: 10px;">{c.mood || '--'}/5</span>
            <span style="color: #595959; font-size: 10px;">⚡{c.energy_morning || '--'}/{c.energy_evening || '--'}</span>
<button onclick={() => editCheckin(c)} style="background: none; border: none; color: #595959; cursor: pointer; font-size: 10px;">✏️</button>
<button onclick={() => deleteCheckin(c)} style="background: none; border: none; color: #595959; cursor: pointer; font-size: 10px;">🗑</button>
          </div>
        {/each}
      {:else}
        <p style="color: #595959; font-size: 12px; text-align: center; padding: 16px;">Aucune donnée</p>
      {/if}
    </div>
  </div>

  <div style="background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
    <p style="color: #8C8C8C; font-size: 12px; margin-bottom: 12px;">😴 Sommeil (7 jours)</p>
    {#if checkins.filter((c: any) => c.sleep_time && c.wake_time).length > 0}
      {@const maxH = Math.max(...checkins.slice(0, 7).map((c: any) => calcSleepHours(c.sleep_time, c.wake_time) || 0), 10)}
      {#each checkins.slice(0, 7).reverse() as c}
        {@const sh = calcSleepHours(c.sleep_time, c.wake_time) || 0}
        {@const pct = Math.min((sh / maxH) * 100, 100)}
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
          <span style="color: {c.date === today ? '#F5F5F5' : '#8C8C8C'}; font-size: 11px; min-width: 32px;">{new Date(c.date).toLocaleDateString('fr-CA', { weekday: 'short' })}</span>
          <div style="flex: 1; height: 20px; background: #262626; border-radius: 4px; overflow: hidden;">
            <div style="width: {pct}%; height: 100%; background: {sh >= 7 ? '#22C55E' : sh >= 5 ? '#F59E0B' : '#EF4444'}; border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: {pct > 15 ? '6px' : '0'};">
              {#if pct > 18}<span style="color: #0D0D0D; font-size: 10px; font-weight: 600;">{sh}h</span>{/if}
            </div>
          </div>
        </div>
      {/each}
    {:else}
      <p style="color: #595959; font-size: 12px; text-align: center;">Utilise "Je me couche" et "Je me réveille"</p>
    {/if}
    {#if avgSleep}
  <p style="color: #595959; font-size: 11px; text-align: center; margin-top: 8px;">Moyenne : {avgSleep}h</p>
{/if}
  </div>

  <div style="background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
    <p style="color: #8C8C8C; font-size: 12px; margin-bottom: 12px;">📱 Temps d'écran (7 jours)</p>
    {#if checkins.filter((c: any) => c.screen_time != null).length > 0}
      {@const maxST = Math.max(...checkins.slice(0, 7).map((c: any) => c.screen_time || 0), 360)}
      {#each checkins.slice(0, 7).reverse() as c}
        {@const st = c.screen_time || 0}
        {@const pct = Math.min((st / maxST) * 100, 100)}
        {@const hours = Math.floor(st / 60)}
        {@const mins = st % 60}
        {@const label = hours > 0 ? hours + 'h' + (mins > 0 ? mins : '') : mins + 'min'}
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
          <span style="color: {c.date === today ? '#F5F5F5' : '#8C8C8C'}; font-size: 11px; min-width: 32px;">{new Date(c.date).toLocaleDateString('fr-CA', { weekday: 'short' })}</span>
          <div style="flex: 1; height: 20px; background: #262626; border-radius: 4px; overflow: hidden;">
            <div style="width: {pct}%; height: 100%; background: {st <= 120 ? '#22C55E' : st <= 300 ? '#F59E0B' : '#EF4444'}; border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: {pct > 15 ? '6px' : '0'};">
              {#if pct > 18}<span style="color: #0D0D0D; font-size: 10px; font-weight: 600;">{label}</span>{/if}
            </div>
          </div>
        </div>
      {/each}
    {:else}
      <p style="color: #595959; font-size: 12px; text-align: center;">Ajoute ton temps d'écran</p>
    {/if}
    {#if avgScreen}
  {@const h = Math.floor(avgScreen / 60)}
  {@const m = avgScreen % 60}
  <p style="color: #595959; font-size: 11px; text-align: center; margin-top: 8px;">Moyenne : {h > 0 ? h + 'h' : ''}{m}min</p>
{/if}
  </div>

  {#if showForm}
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px;" onclick={() => showForm = false}>
      <div style="background: #141414; border: 1px solid #262626; border-radius: 16px; padding: 24px; width: 100%; max-width: 400px; max-height: 85dvh; overflow-y: auto;" onclick={(e: any) => e.stopPropagation()}>
        <h2 style="color: #F5F5F5; font-size: 18px; font-weight: 500; margin-bottom: 20px;">Check-in du jour</h2>

        <div style="display: flex; gap: 10px; margin-bottom: 16px;">
          <div style="flex: 1;">
            <label style="color: #8C8C8C; font-size: 11px; display: block; margin-bottom: 4px;">😴 Coucher</label>
            <input type="time" bind:value={sleepTime} style="width: 100%; background: #0D0D0D; border: 1px solid #262626; border-radius: 8px; padding: 10px; font-size: 14px; color: #F5F5F5; outline: none; box-sizing: border-box;" />
          </div>
          <div style="flex: 1;">
            <label style="color: #8C8C8C; font-size: 11px; display: block; margin-bottom: 4px;">⏰ Réveil</label>
            <input type="time" bind:value={wakeTime} style="width: 100%; background: #0D0D0D; border: 1px solid #262626; border-radius: 8px; padding: 10px; font-size: 14px; color: #F5F5F5; outline: none; box-sizing: border-box;" />
          </div>
        </div>
        {#if sleepHours}
          <p style="color: #6366F1; font-size: 13px; margin-bottom: 16px;">→ {sleepHours}h de sommeil</p>
        {/if}

        <label style="color: #8C8C8C; font-size: 12px; display: block; margin-bottom: 6px;">Qualité sommeil</label>
        <div style="display: flex; gap: 6px; margin-bottom: 16px;">
          {#each [1,2,3,4,5] as v}
            <button onclick={() => sleepQuality = v} style="flex: 1; padding: 10px; border-radius: 8px; border: 2px solid {sleepQuality === v ? '#6366F1' : '#262626'}; background: {sleepQuality === v ? '#1A1A3A' : 'transparent'}; color: white; font-size: 14px; cursor: pointer;">{v}</button>
          {/each}
        </div>

        <label style="color: #8C8C8C; font-size: 12px; display: block; margin-bottom: 6px;">Énergie matin</label>
        <div style="display: flex; gap: 6px; margin-bottom: 16px;">
          {#each [1,2,3,4,5] as v}
            <button onclick={() => energyMorning = v} style="flex: 1; padding: 10px; border-radius: 8px; border: 2px solid {energyMorning === v ? '#F59E0B' : '#262626'}; background: {energyMorning === v ? '#1A1A0A' : 'transparent'}; color: white; font-size: 14px; cursor: pointer;">{v}</button>
          {/each}
        </div>

        <label style="color: #8C8C8C; font-size: 12px; display: block; margin-bottom: 6px;">Énergie soir</label>
        <div style="display: flex; gap: 6px; margin-bottom: 16px;">
          {#each [1,2,3,4,5] as v}
            <button onclick={() => energyEvening = v} style="flex: 1; padding: 10px; border-radius: 8px; border: 2px solid {energyEvening === v ? '#F59E0B' : '#262626'}; background: {energyEvening === v ? '#1A1A0A' : 'transparent'}; color: white; font-size: 14px; cursor: pointer;">{v}</button>
          {/each}
        </div>

        <label style="color: #8C8C8C; font-size: 12px; display: block; margin-bottom: 6px;">Humeur</label>
        <div style="display: flex; gap: 6px; margin-bottom: 16px;">
          {#each [1,2,3,4,5] as v}
            <button onclick={() => mood = v} style="flex: 1; padding: 10px; border-radius: 8px; border: 2px solid {mood === v ? '#22C55E' : '#262626'}; background: {mood === v ? '#0A1A0A' : 'transparent'}; color: white; font-size: 18px; cursor: pointer;">{moodEmoji(v)}</button>
          {/each}
        </div>

        <label style="color: #8C8C8C; font-size: 12px; display: block; margin-bottom: 6px;">Temps d'écran (min)</label>
        <input type="number" placeholder="ex: 120" bind:value={screenTime} min="0" style="width: 100%; background: #0D0D0D; border: 1px solid #262626; border-radius: 8px; padding: 10px; font-size: 14px; color: #F5F5F5; outline: none; margin-bottom: 16px; box-sizing: border-box;" />

        <label style="color: #8C8C8C; font-size: 12px; display: block; margin-bottom: 6px;">Notes</label>
        <textarea placeholder="Une pensée..." bind:value={notes} style="width: 100%; background: #0D0D0D; border: 1px solid #262626; border-radius: 8px; padding: 10px; font-size: 14px; color: #F5F5F5; outline: none; margin-bottom: 16px; box-sizing: border-box; resize: vertical; min-height: 50px;"></textarea>
<label style="color: #8C8C8C; font-size: 12px; display: block; margin-bottom: 6px;">Trackers</label>
<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px;">
  {#each trackers as t}
    <button onclick={() => toggleTracker(t.key)}
      style="display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 8px; border: 1px solid #262626; background: {t.value ? '#1A2A1A' : '#141414'}; cursor: pointer;"
    >
      <span style="font-size: 14px;">{t.icon}</span>
      <span style="font-size: 11px; color: {t.value ? '#22C55E' : '#595959'}; font-weight: {t.value ? '500' : '400'};">
        {t.label}
      </span>
    </button>
  {/each}
</div>
        <button onclick={saveCheckin} disabled={saving}
          style="width: 100%; padding: 14px; background: #3B82F6; color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 500; cursor: pointer;">
          {saving ? 'Sauvegarde...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  {/if}

  {#if selectedDay}
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; display: flex; align-items: flex-end; justify-content: center;" onclick={closeDayDetail}>
      <div style="background: #141414; border: 1px solid #262626; border-radius: 16px 16px 0 0; padding: 20px 16px 32px; width: 100%; max-width: 500px; max-height: 75dvh; overflow-y: auto;" onclick={(e: any) => e.stopPropagation()}>
        <div style="width: 36px; height: 4px; background: #595959; border-radius: 2px; margin: 0 auto 16px;"></div>
        
        <h2 style="color: #F5F5F5; font-size: 18px; font-weight: 500; margin-bottom: 4px;">
          {new Date(selectedDay.date).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h2>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px;">
          <div style="background: #0D0D0D; border: 1px solid #262626; border-radius: 8px; padding: 12px;">
            <p style="color: #595959; font-size: 10px; text-transform: uppercase;">😴 Sommeil</p>
            <p style="color: #F5F5F5; font-size: 18px; font-weight: 500;">{dayDetailSleep(selectedDay) || '--'}h</p>

            <p style="color: #595959; font-size: 10px;">{selectedDay.sleep_time || '--'} → {selectedDay.wake_time || '--'}</p>
          </div>
          <div style="background: #0D0D0D; border: 1px solid #262626; border-radius: 8px; padding: 12px;">
            <p style="color: #595959; font-size: 10px; text-transform: uppercase;">⭐ Qualité</p>
            <p style="color: #F5F5F5; font-size: 18px; font-weight: 500;">{selectedDay.sleep_quality || '--'}/5</p>
          </div>
          <div style="background: #0D0D0D; border: 1px solid #262626; border-radius: 8px; padding: 12px;">
            <p style="color: #595959; font-size: 10px; text-transform: uppercase;">⚡ Énergie</p>
            <p style="color: #F5F5F5; font-size: 18px; font-weight: 500;">{selectedDay.energy_morning || '--'}/{selectedDay.energy_evening || '--'}</p>
          </div>
          <div style="background: #0D0D0D; border: 1px solid #262626; border-radius: 8px; padding: 12px;">
            <p style="color: #595959; font-size: 10px; text-transform: uppercase;">😊 Humeur</p>
            <p style="color: #F5F5F5; font-size: 24px;">{moodEmoji(selectedDay.mood)}</p>
          </div>
          <div style="background: #0D0D0D; border: 1px solid #262626; border-radius: 8px; padding: 12px;">
            <p style="color: #595959; font-size: 10px; text-transform: uppercase;">📱 Écran</p>
            <p style="color: #F5F5F5; font-size: 18px; font-weight: 500;">{selectedDay.screen_time || '--'} min</p>
          </div>
          <div style="background: #0D0D0D; border: 1px solid #262626; border-radius: 8px; padding: 12px;">
            <p style="color: #595959; font-size: 10px; text-transform: uppercase;">📝 Notes</p>
            <p style="color: #8C8C8C; font-size: 12px;">{selectedDay.notes || 'Aucune'}</p>
          </div>
        </div>

        <p style="color: #595959; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 16px; margin-bottom: 8px;">Trackers</p>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          {#each trackers as t}
            <div style="display: flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 8px; border: 1px solid #262626; background: {selectedDay[t.key] ? '#1A2A1A' : '#141414'};">
              <span style="font-size: 14px;">{t.icon}</span>
              <span style="font-size: 10px; color: {selectedDay[t.key] ? '#22C55E' : '#595959'};">{selectedDay[t.key] ? 'Fait' : 'Pas fait'}</span>
            </div>
          {/each}
        </div>

        <button onclick={closeDayDetail}
          style="width: 100%; margin-top: 16px; padding: 10px; background: transparent; color: #8C8C8C; border: 1px solid #262626; border-radius: 8px; font-size: 14px; cursor: pointer;">Fermer</button>
      </div>
    </div>
  {/if}
</div>