<script lang="ts">
  import { onMount } from 'svelte';
import {
  loadPrayers, savePrayer,
  loadSurahs, loadMemorization, addMemorization, toggleMemorized,
  loadTopics, toggleTopic,
  loadProphets, loadCompanions, setStatus,
  loadObjectives, createObjective, updateObjective, deleteObjective,
  type Surah, type Prayer, type Memorization, type Topic, type Prophet, type Companion, type Objective
} from '$lib/deenApi';

  let activeTab = $state('prayer');
  let today = new Date().toISOString().split('T')[0];
  let currentMonth = $state(new Date().getMonth());
  let currentYear = $state(new Date().getFullYear());

  let monthPrayers: Prayer[] = $state([]);
  let surahs: Surah[] = $state([]);
  let memorization: Memorization[] = $state([]);
  let topics: Topic[] = $state([]);
  let prophets: Prophet[] = $state([]);
  let companions: Companion[] = $state([]);
  let objectives: Objective[] = $state([]);

  let currentSurah: Surah | null = $state(null);
  let newPagesMemorized = $state('');
  let showObjectiveForm = $state(false);
  let objTitle = $state('');
  let objType = $state('knowledge');
  let objTarget = $state('10');

  onMount(() => { loadAll(); });

  async function loadAll() {
    [monthPrayers, surahs, memorization, topics, prophets, companions, objectives] = await Promise.all([
      loadPrayers(currentYear, currentMonth),
      loadSurahs(),
      loadMemorization(),
      loadTopics(),
      loadProphets(),
      loadCompanions(),
      loadObjectives(),
    ]);
  }
  async function handleToggleMemorized(surah: Surah, memo: Memorization | undefined) {
  const newVal = !memo?.memorized;
  await toggleMemorized(surah.id, newVal, today);
  memorization = await loadMemorization();
}

let globalPercent = $derived(
  (() => {
    const totalPages = surahs.reduce((s, su) => s + (su.pages || 0), 0);
    const memoPages = memorization
      .filter(m => m.memorized)
      .reduce((s, m) => {
        const surah = surahs.find(su => su.id === m.surah);
        return s + (surah?.pages || 0);
      }, 0);
    return totalPages > 0 ? Math.round((memoPages / totalPages) * 1000) / 10 : 0;
  })()
);

let reviewQueue = $derived(
  memorization
    .filter(m => m.memorized && m.last_reviewed && (Date.now() - new Date(m.last_reviewed).getTime()) / 86400000 > 30)
    .sort((a, b) => (a.last_reviewed || '').localeCompare(b.last_reviewed || ''))
    .slice(0, 5)
);

  // Prières
  function getPrayerValue(date: string, field: string): string {
    const p = monthPrayers.find(p => p.date === date);
    return p ? (p as any)[field] || '' : '';
  }

  async function cyclePrayer(date: string, field: string) {
    const current = getPrayerValue(date, field);
    const next = current === '' ? 'on_time' : current === 'on_time' ? 'late' : current === 'late' ? 'missed' : '';
    await savePrayer(date, field, next);
    const idx = monthPrayers.findIndex(p => p.date === date);
    if (idx >= 0) (monthPrayers[idx] as any)[field] = next;
    else monthPrayers = [...monthPrayers, { id: '', date, [field]: next } as unknown as Prayer];
  }

  async function toggleBinary(date: string, field: string) {
    const current = getPrayerValue(date, field);
    const next = current === 'yes' ? 'no' : 'yes';
    await savePrayer(date, field, next);
    const idx = monthPrayers.findIndex(p => p.date === date);
    if (idx >= 0) (monthPrayers[idx] as any)[field] = next;
    else monthPrayers = [...monthPrayers, { id: '', date, [field]: next } as unknown as Prayer];
  }

  // Coran
  async function handleAddMemorization() {
    if (!currentSurah || !newPagesMemorized) return;
    await addMemorization(currentSurah.id, parseFloat(newPagesMemorized), today);
    memorization = await loadMemorization();
    newPagesMemorized = '';
  }

  function getMemoPages(surahId: string): number {
    return memorization.find(m => m.surah === surahId)?.pages_memorized || 0;
  }

  // Thématiques
  async function handleToggleTopic(topic: Topic) {
    if (!topic.active && activeTopics.length >= 3) {
      alert('Maximum 3 sujets actifs.');
      return;
    }
    await toggleTopic(topic.id, !topic.active);
    topic.active = !topic.active;
  }

  // Prophètes & Compagnons
  async function handleSetStatus(collection: string, record: any, status: string) {
    await setStatus(collection, record.id, status);
    record.status = status;
  }

  // Objectifs
  async function handleAddObjective() {
    if (!objTitle.trim()) return;
    await createObjective({ title: objTitle, type: objType, target: parseInt(objTarget) });
    objTitle = '';
    showObjectiveForm = false;
    objectives = await loadObjectives();
  }

  async function handleUpdateObjective(obj: Objective, increment: boolean) {
    const current = increment ? obj.current + 1 : Math.max(0, obj.current - 1);
    await updateObjective(obj.id, { current, done: current >= obj.target });
    obj.current = current;
    obj.done = current >= obj.target;
  }

  async function handleDeleteObjective(obj: Objective) {
    await deleteObjective(obj.id);
    objectives = await loadObjectives();
  }

  // Navigation
  function prevMonth() {
    if (currentMonth === 0) { currentMonth = 11; currentYear--; }
    else currentMonth--;
    loadPrayers(currentYear, currentMonth).then(r => monthPrayers = r);
  }

  function nextMonth() {
    if (currentMonth === 11) { currentMonth = 0; currentYear++; }
    else currentMonth++;
    loadPrayers(currentYear, currentMonth).then(r => monthPrayers = r);
  }

  let monthDays = $derived(
    (() => {
      const days = [];
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      for (let d = 1; d <= lastDay; d++) {
        const date = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push({ day: d, date, isToday: date === today });
      }
      return days;
    })()
  );

  const categories = ['Fiqh', 'Aqida', 'Coran', 'Hadith', 'Sira & Histoire', 'Adab & Spiritualité'];

  function prayerColor(val: string): string {
    if (val === 'on_time') return '#22C55E';
    if (val === 'late') return '#F59E0B';
    if (val === 'missed') return '#EF4444';
    return '#262626';
  }

  function statusIcon(s: string): string {
    if (s === 'done') return '✅';
    if (s === 'in_progress') return '🔄';
    if (s === 'deep') return '⭐';
    return '⬜';
  }

  function statusLabel(s: string): string {
    if (s === 'done') return 'Fait';
    if (s === 'in_progress') return 'En cours';
    if (s === 'deep') return 'Approfondir';
    return 'À faire';
  }
</script>

<div>
  <div style="margin-bottom: 20px;">
    <p style="color: #595959; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Deen</p>
    <h1 style="font-size: 20px; font-weight: 500; color: #F5F5F5; margin-top: 2px;">Tableau de bord</h1>
  </div>

  <div style="display: flex; gap: 4px; background: #141414; border-radius: 8px; padding: 4px; border: 1px solid #262626; margin-bottom: 20px; overflow-x: auto;">
    {#each [
      { key: 'prayer', label: 'Prière', icon: '🕌' },
      { key: 'quran', label: 'Coran', icon: '📖' },
      { key: 'topics', label: 'Thématiques', icon: '📚' },
      { key: 'prophets', label: 'Prophètes', icon: '👤' },
      { key: 'companions', label: 'Compagnons', icon: '🤝' },
      { key: 'objectives', label: 'Objectifs', icon: '🎯' }
    ] as t}
      <button onclick={() => activeTab = t.key}
        style="flex: 1; padding: 8px 6px; border-radius: 6px; font-size: 11px; border: none; cursor: pointer; white-space: nowrap;
          {activeTab === t.key ? 'background: #1A1A1A; color: #F5F5F5;' : 'background: transparent; color: #595959;'}">
        {t.icon} {t.label}
      </button>
    {/each}
  </div>

  <!-- ═══ PRIÈRE ═══ -->
  {#if activeTab === 'prayer'}
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <button onclick={prevMonth} style="background: none; border: none; color: #8C8C8C; cursor: pointer; font-size: 16px;">◀</button>
      <span style="color: #F5F5F5; font-size: 14px; font-weight: 500;">
        {new Date(currentYear, currentMonth).toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })}
      </span>
      <button onclick={nextMonth} style="background: none; border: none; color: #8C8C8C; cursor: pointer; font-size: 16px;">▶</button>
    </div>

    <div style="background: #141414; border: 1px solid #262626; border-radius: 10px; overflow-x: auto; padding: 10px;">
      <div style="display: grid; grid-template-columns: 40px repeat({monthDays.length}, 28px); gap: 3px; align-items: center; min-width: 600px;">
        <span style="color: #595959; font-size: 10px;"></span>
        {#each monthDays as d}
          <span style="color: {d.isToday ? '#F5F5F5' : '#595959'}; font-size: 10px; text-align: center; font-weight: {d.isToday ? '600' : '400'};">{d.day}</span>
        {/each}

        {#each ['Fajr', 'Dohr', 'Asr', 'Maghrib', 'Isha', 'Chaf', 'Witr', 'Réveil'] as label, idx}
          <span style="color: #8C8C8C; font-size: 10px;">{label}</span>
          {#each monthDays as d}
            {@const field = idx < 5 ? ['fajr','dohr','asr','maghrib','isha'][idx] : idx === 5 ? 'chaf' : idx === 6 ? 'witr' : 'fajr_wakeup'}
            {@const val = getPrayerValue(d.date, field)}
            {#if idx < 5 || idx === 7}
              <button onclick={() => cyclePrayer(d.date, field)}
                style="width: 24px; height: 24px; border-radius: 4px; border: 1px solid {val ? prayerColor(val) : '#262626'}; background: {val ? prayerColor(val) : 'transparent'}; cursor: pointer; padding: 0;">
                <span style="font-size: 8px; color: {val ? '#0D0D0D' : '#595959'};">
                  {val === 'on_time' ? '✓' : val === 'late' ? '⏰' : val === 'missed' ? '✕' : ''}
                </span>
              </button>
            {:else}
              <button onclick={() => toggleBinary(d.date, field)}
                style="width: 24px; height: 24px; border-radius: 4px; border: 1px solid #262626; background: {val === 'yes' ? '#22C55E' : 'transparent'}; cursor: pointer; padding: 0; font-size: 10px; color: {val === 'yes' ? '#0D0D0D' : '#595959'};">
                {val === 'yes' ? '✓' : ''}
              </button>
            {/if}
          {/each}
        {/each}
      </div>
    </div>

<!-- ═══ CORAN ═══ -->
{:else if activeTab === 'quran'}
  <div style="background: linear-gradient(135deg, #141414 0%, #1A1A1A 100%); border: 1px solid #262626; border-radius: 16px; padding: 24px; margin-bottom: 20px; text-align: center;">
    <p style="color: #8C8C8C; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">Coran mémorisé</p>
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r="60" fill="none" stroke="#262626" stroke-width="8" />
      <circle cx="70" cy="70" r="60" fill="none" stroke="#22C55E" stroke-width="8"
        stroke-dasharray={`${(globalPercent / 100) * 377} 377`}
        stroke-linecap="round" transform="rotate(-90 70 70)" />
    </svg>
    <div style="position: relative; margin-top: -110px; margin-bottom: 80px;">
      <span style="font-size: 36px; font-weight: 500; color: #F5F5F5;">{globalPercent}%</span>
    </div>
  </div>

  <!-- Kanban révision -->
  {#if reviewQueue.length > 0}
    <div style="background: #141414; border: 1px solid #262626; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
      <p style="color: #EF4444; font-size: 12px; text-transform: uppercase; margin-bottom: 10px;">⚠️ À réviser (>{30} jours)</p>
      {#each reviewQueue as r}
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #262626;">
          <span style="color: #F5F5F5; font-size: 13px;">{surahs.find(s => s.id === r.surah)?.name || 'Inconnue'}</span>
          <span style="color: #EF4444; font-size: 11px;">{r.last_reviewed ? Math.floor((Date.now() - new Date(r.last_reviewed).getTime()) / 86400000) + 'j' : 'Jamais'}</span>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Liste des sourates avec checkbox -->
  <div style="background: #141414; border: 1px solid #262626; border-radius: 10px; padding: 14px;">
    <p style="color: #8C8C8C; font-size: 12px; margin-bottom: 10px;">Sourates ({memorization.filter(m => m.memorized).length}/{surahs.length})</p>
    <div style="max-height: 400px; overflow-y: auto;">
      {#each surahs as s}
        {@const memo = memorization.find(m => m.surah === s.id)}
        <div style="display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid #262626;">
          <button onclick={() => handleToggleMemorized(s, memo)}
            style="width: 24px; height: 24px; border-radius: 4px; border: 2px solid {memo?.memorized ? '#22C55E' : '#262626'}; background: {memo?.memorized ? '#22C55E' : 'transparent'}; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
            {#if memo?.memorized}
              <span style="color: #0D0D0D; font-size: 12px; font-weight: 700;">✓</span>
            {/if}
          </button>
          <span style="color: {memo?.memorized ? '#22C55E' : '#8C8C8C'}; font-size: 12px; flex: 1;">
            {s.number}. {s.name}
          </span>
          <span style="color: #595959; font-size: 10px;">{s.pages} p.</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- ═══ THÉMATIQUES ═══ -->
  {:else if activeTab === 'topics'}
    <p style="color: #8C8C8C; font-size: 12px; margin-bottom: 8px;">Max 3 sujets actifs</p>
    {#each categories as cat}
      {@const catTopics = topics.filter(t => t.category === cat)}
      {#if catTopics.length > 0}
        <div style="margin-bottom: 16px;">
          <p style="color: #8C8C8C; font-size: 11px; text-transform: uppercase; margin-bottom: 6px;">{cat}</p>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            {#each catTopics as t}
              <button onclick={() => handleToggleTopic(t)}
                style="padding: 8px 12px; border-radius: 8px; border: 1px solid {t.active ? '#22C55E' : '#262626'}; background: {t.active ? '#1A2A1A' : '#141414'}; cursor: pointer; font-size: 12px; color: {t.active ? '#22C55E' : '#8C8C8C'};">
                {t.name}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    {/each}

  <!-- ═══ PROPHÈTES ═══ -->
  {:else if activeTab === 'prophets'}
    <div style="background: #141414; border: 1px solid #262626; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #8C8C8C; font-size: 12px;">Progression</span>
        <span style="color: #F5F5F5; font-size: 12px;">{prophets.filter(p => p.status === 'done').length}/{prophets.length}</span>
      </div>
      <div style="width: 100%; height: 6px; background: #262626; border-radius: 3px; overflow: hidden;">
        <div style="width: {(prophets.filter(p => p.status === 'done').length / prophets.length) * 100}%; height: 100%; background: #22C55E; border-radius: 3px;"></div>
      </div>
    </div>

    {#each prophets as p}
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #141414; border: 1px solid #262626; border-radius: 8px; margin-bottom: 6px;">
        <span style="color: #F5F5F5; font-size: 13px;">{p.name}</span>
        <div style="display: flex; gap: 4px;">
          {#each ['not_started', 'in_progress', 'done', 'deep'] as st}
            <button onclick={() => handleSetStatus('prophets', p, st)}
              style="padding: 4px 8px; border-radius: 4px; border: 1px solid {p.status === st ? '#22C55E' : '#262626'}; background: {p.status === st ? '#1A2A1A' : 'transparent'}; cursor: pointer; font-size: 12px;"
              title={statusLabel(st)}>{statusIcon(st)}</button>
          {/each}
        </div>
      </div>
    {/each}

  <!-- ═══ COMPAGNONS ═══ -->
  {:else if activeTab === 'companions'}
    <div style="background: #141414; border: 1px solid #262626; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #8C8C8C; font-size: 12px;">Progression</span>
        <span style="color: #F5F5F5; font-size: 12px;">{companions.filter(c => c.status === 'done').length}/{companions.length}</span>
      </div>
      <div style="width: 100%; height: 6px; background: #262626; border-radius: 3px; overflow: hidden;">
        <div style="width: {(companions.filter(c => c.status === 'done').length / companions.length) * 100}%; height: 100%; background: #22C55E; border-radius: 3px;"></div>
      </div>
    </div>

    {#each companions as c}
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #141414; border: 1px solid #262626; border-radius: 8px; margin-bottom: 6px;">
        <span style="color: #F5F5F5; font-size: 13px;">{c.name}</span>
        <div style="display: flex; gap: 4px;">
          {#each ['not_started', 'in_progress', 'done', 'deep'] as st}
            <button onclick={() => handleSetStatus('companions', c, st)}
              style="padding: 4px 8px; border-radius: 4px; border: 1px solid {c.status === st ? '#22C55E' : '#262626'}; background: {c.status === st ? '#1A2A1A' : 'transparent'}; cursor: pointer; font-size: 12px;"
              title={statusLabel(st)}>{statusIcon(st)}</button>
          {/each}
        </div>
      </div>
    {/each}

  <!-- ═══ OBJECTIFS ═══ -->
  {:else if activeTab === 'objectives'}
    <button onclick={() => showObjectiveForm = true}
      style="width: 100%; padding: 10px; background: #3B82F6; color: white; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; margin-bottom: 16px;">
      + Nouvel objectif
    </button>

    {#if showObjectiveForm}
      <div style="background: #141414; border: 1px solid #262626; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
        <input type="text" placeholder="Titre" bind:value={objTitle}
          style="width: 100%; background: #0D0D0D; border: 1px solid #262626; border-radius: 6px; padding: 8px; font-size: 13px; color: #F5F5F5; outline: none; margin-bottom: 8px; box-sizing: border-box;" />
        <select bind:value={objType}
          style="width: 100%; background: #0D0D0D; border: 1px solid #262626; border-radius: 6px; padding: 8px; font-size: 13px; color: #F5F5F5; outline: none; margin-bottom: 8px; box-sizing: border-box;">
          <option value="consistency">Constance</option>
          <option value="knowledge">Connaissance</option>
          <option value="challenge">Défi</option>
        </select>
        <input type="number" placeholder="Cible" bind:value={objTarget}
          style="width: 100%; background: #0D0D0D; border: 1px solid #262626; border-radius: 6px; padding: 8px; font-size: 13px; color: #F5F5F5; outline: none; margin-bottom: 8px; box-sizing: border-box;" />
        <div style="display: flex; gap: 6px;">
          <button onclick={() => showObjectiveForm = false} style="flex: 1; padding: 8px; background: transparent; border: 1px solid #262626; border-radius: 6px; color: #8C8C8C; font-size: 12px; cursor: pointer;">Annuler</button>
          <button onclick={handleAddObjective} disabled={!objTitle.trim()} style="flex: 1; padding: 8px; background: #22C55E; color: #0D0D0D; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">Créer</button>
        </div>
      </div>
    {/if}

    {#each objectives as obj}
      <div style="background: #141414; border: 1px solid #262626; border-radius: 10px; padding: 14px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="color: #F5F5F5; font-size: 13px; font-weight: 500;">{obj.title}</span>
          <span style="color: #595959; font-size: 10px; background: #1A1A1A; padding: 2px 8px; border-radius: 4px;">{obj.type}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button onclick={() => handleUpdateObjective(obj, false)} style="background: none; border: 1px solid #262626; border-radius: 4px; padding: 2px 8px; color: #8C8C8C; cursor: pointer; font-size: 14px;">−</button>
          <div style="flex: 1; height: 6px; background: #262626; border-radius: 3px; overflow: hidden;">
            <div style="width: {Math.min(100, (obj.current / obj.target) * 100)}%; height: 100%; background: {obj.done ? '#22C55E' : '#3B82F6'}; border-radius: 3px;"></div>
          </div>
          <button onclick={() => handleUpdateObjective(obj, true)} style="background: none; border: 1px solid #262626; border-radius: 4px; padding: 2px 8px; color: #8C8C8C; cursor: pointer; font-size: 14px;">+</button>
          <span style="color: #F5F5F5; font-size: 11px; min-width: 40px; text-align: center;">{obj.current}/{obj.target}</span>
          <button onclick={() => handleDeleteObjective(obj)} style="background: none; border: none; color: #595959; cursor: pointer; font-size: 12px;">🗑</button>
        </div>
      </div>
    {/each}

    {#if objectives.length === 0 && !showObjectiveForm}
      <p style="color: #595959; text-align: center; padding: 32px;">Aucun objectif.</p>
    {/if}
  {/if}
</div>