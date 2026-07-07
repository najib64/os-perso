<script lang="ts">
import { onMount } from 'svelte';
import pb from '$lib/pocketbase';

let lastWorkouts: Record<string, any[]> = $state({});

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

  let exercises: any[] = $state([]);
  let loading = $state(true);
  let newName = $state('');
  let newMuscle = $state('Chest');
  let newType = $state('Composé');
  let adding = $state(false);
  let activeTab = $state('exercises');

  let tracking = $state(false);
  let workoutType = $state('');
  let workoutExercises: any[] = $state([]);
  let showExercisePicker = $state(false);
  let searchFilter = $state('');

  let pastWorkouts: any[] = $state([]);
  let loadingWorkouts = $state(false);
  let selectedWorkout: any = $state(null);
  let loadingDetail = $state(false);

  let bodyweights: any[] = $state([]);
  let newWeight = $state('');

  let contract: any = $state(null);
  let contractTarget = $state(3);
  let showContractSetup = $state(false);
  let showFailModal = $state(false);
  let failReason = $state('');

  const workoutTypes = [
    { value: 'push', label: 'Push', muscles: ['Chest', 'Shoulders', 'Triceps'] },
    { value: 'pull', label: 'Pull', muscles: ['Back', 'Biceps'] },
    { value: 'legs', label: 'Legs', muscles: ['Legs', 'Core'] },
    { value: 'full', label: 'Full Body', muscles: [] },
  ];

  const muscleGroups = ['Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core'];
  const exerciseTypes = ['Composé', 'Isolation'];
  const groupLabels: Record<string, string> = {
    Chest: 'Pectoraux', Back: 'Dos', Legs: 'Jambes', Shoulders: 'Épaules',
    Biceps: 'Biceps', Triceps: 'Triceps', Core: 'Abdos',
  };

  onMount(() => { loadExercises(); loadContract(); });
  onMount(() => { 
  setTimeout(() => {
    loadExercises(); 
    loadContract();
  }, 300);
});
  
  // Quick start
  const url = new URL(window.location.href);
  const q = url.searchParams.get('quick');
  if (q) {
    quickData = JSON.parse(decodeURIComponent(q));
    workoutType = quickData.type;
    workoutExercises = quickData.exercises.map((ex: any) => ({
      exerciseId: ex.id,
      name: ex.name,
      sets: [{ weight: '', reps: '' }],
    }));
    tracking = true;
    window.history.replaceState({}, '', '/gym');
  };

  async function loadExercises() {
    loading = true;
    try { exercises = await pb.collection('exercises').getFullList({ sort: 'muscle_group,name' }); }
    catch (error) { console.error('Erreur chargement exercices:', error); }
    loading = false;
  }

  async function addExercise() {
    if (!newName.trim()) return;
    adding = true;
    try {
      await pb.collection('exercises').create({ name: newName.trim(), muscle_group: newMuscle, type: newType });
      newName = '';
      await loadExercises();
    } catch (error) { console.error('Erreur ajout exercice:', error); }
    adding = false;
  }

  let grouped = $derived(
    exercises.reduce((acc: Record<string, any[]>, ex) => {
      if (!acc[ex.muscle_group]) acc[ex.muscle_group] = [];
      acc[ex.muscle_group].push(ex);
      return acc;
    }, {} as Record<string, any[]>)
  );

  async function loadWorkouts() {
    loadingWorkouts = true;
    try { pastWorkouts = await pb.collection('workouts').getFullList({ sort: '-date' }); }
    catch (error) { console.error('Erreur chargement séances:', error); }
    loadingWorkouts = false;
  }

  async function loadBodyweights() {
    try { bodyweights = await pb.collection('bodyweight').getFullList({ sort: 'date' }); }
    catch (error) { console.error('Erreur chargement poids:', error); }
  }

  async function saveWeight() {
    if (!newWeight) return;
    try {
      await pb.collection('bodyweight').create({ date: new Date().toISOString().split('T')[0], weight: parseFloat(newWeight) });
      newWeight = '';
      await loadBodyweights();
    } catch (error) { console.error('Erreur sauvegarde poids:', error); }
  }

  function switchTab(tab: string) {
    activeTab = tab;
    if (tab === 'workouts') loadWorkouts();
    if (tab === 'stats') { loadBodyweights(); loadContract(); }
  }

function getWeekStart() {
  const now = new Date();
  const day = now.getDay(); // 0=dimanche, 1=lundi, ... 6=samedi
  
  // Aller au lundi de cette semaine
  const monday = new Date(now);
  if (day === 0) {
    // Dimanche -> lundi suivant
    monday.setDate(now.getDate() + 1);
  } else {
    // Lundi à samedi -> lundi de cette semaine
    monday.setDate(now.getDate() - (day - 1));
  }
  
  // Reset heures
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

  function getWeekEnd() {
    const d = new Date(getWeekStart());
    d.setDate(d.getDate() + 6);
    return d.toISOString().split('T')[0];
  }

async function loadContract() {
  const ws = getWeekStart();
  try {
    const records = await pb.collection('contracts').getFullList({
      filter: `week_start >= "${ws}" && week_start < "${getWeekEnd()}"`,
    });
    contract = records.length > 0 ? records[0] : null;
  } catch (error) { console.error('Erreur chargement contrat:', error); }
}
async function setupContract() {
  const ws = getWeekStart();
  try {
    const created = await pb.collection('contracts').create({ week_start: ws, target: contractTarget });
    contract = created;
    showContractSetup = false;
    await loadWorkouts();
  } catch (error) { console.error('Erreur création contrat:', error); }
}

  let contractActual = $derived(
    (() => {
      if (!contract) return 0;
      return pastWorkouts.filter((w: any) => w.date >= contract.week_start && w.date <= getWeekEnd()).length;
    })()
  );

  let contractProgress = $derived(
    contract ? Math.min(100, Math.round((contractActual / contract.target) * 100)) : 0
  );

  let contractFailed = $derived(
    (() => {
      if (!contract) return false;
      if (contract.failed) return true;
      const now = new Date().toISOString().split('T')[0];
      if (now > getWeekEnd() && contractActual < contract.target) return true;
      return false;
    })()
  );

  async function openWorkoutDetail(workout: any) {
    selectedWorkout = workout;
    loadingDetail = true;
    try {
      const records = await pb.collection('workout_exercises').getFullList({
        filter: `workout = "${workout.id}"`, sort: 'order', expand: 'exercise',
      });
      for (const we of records) {
        we.sets = await pb.collection('sets').getFullList({
          filter: `workout_exercise = "${we.id}"`, sort: 'set_number',
        });
      }
      selectedWorkout = { ...workout, exercises: records };
    } catch (error) { console.error('Erreur chargement détail:', error); }
    loadingDetail = false;
  }

  function closeDetail() { selectedWorkout = null; }

  async function deleteWorkout(workout: any, event: Event) {
    event.stopPropagation();
    if (!confirm('Supprimer cette séance ?')) return;
    try {
      if (workout.exercises) {
        for (const we of workout.exercises) {
          if (we.sets) for (const s of we.sets) await pb.collection('sets').delete(s.id);
          await pb.collection('workout_exercises').delete(we.id);
        }
      }
      await pb.collection('workouts').delete(workout.id);
      closeDetail();
      await loadWorkouts();
    } catch (error) { console.error('Erreur suppression:', error); }
  }

  function startTracking() {
    if (!workoutType) return;
    workoutExercises = [];
    tracking = true;
  }

  function getAllowedMuscles() {
    const wt = workoutTypes.find((w) => w.value === workoutType);
    return wt && wt.muscles.length > 0 ? wt.muscles : [];
  }

  let pickerExercises = $derived(
    (() => {
      const allowed = getAllowedMuscles();
      let list = allowed.length === 0 ? exercises : exercises.filter((ex) => allowed.includes(ex.muscle_group));
      if (searchFilter) list = list.filter((ex) => ex.name.toLowerCase().includes(searchFilter.toLowerCase()));
      return list;
    })()
  );

  function addExerciseToWorkout(ex: any) {
    workoutExercises = [...workoutExercises, { exerciseId: ex.id, name: ex.name, sets: [{ weight: '', reps: '' }] }];
    searchFilter = '';
    showExercisePicker = false;
  }

  function addSet(index: number) {
    workoutExercises[index].sets = [...workoutExercises[index].sets, { weight: '', reps: '' }];
    workoutExercises = [...workoutExercises];
  }

  function updateSet(exIdx: number, setIdx: number, field: 'weight' | 'reps', value: string) {
    workoutExercises[exIdx].sets[setIdx][field] = value;
    workoutExercises = [...workoutExercises];
  }

  function removeSet(exIdx: number, setIdx: number) {
    workoutExercises[exIdx].sets = workoutExercises[exIdx].sets.filter((_: any, j: number) => j !== setIdx);
    workoutExercises = [...workoutExercises];
  }

  function removeExerciseFromWorkout(index: number) {
    workoutExercises = workoutExercises.filter((_, i) => i !== index);
  }

  async function finishWorkout() {
    try {
      const workout = await pb.collection('workouts').create({
        date: new Date().toISOString().split('T')[0], muscle_group: workoutType, duration_minutes: 1, notes: '',
      });
      for (let i = 0; i < workoutExercises.length; i++) {
        const we = await pb.collection('workout_exercises').create({
          workout: workout.id, exercise: workoutExercises[i].exerciseId, order: i + 1,
        });
        for (let j = 0; j < workoutExercises[i].sets.length; j++) {
          const s = workoutExercises[i].sets[j];
          if (s.weight && s.reps && !isNaN(parseFloat(s.weight)) && !isNaN(parseInt(s.reps))) {
            await pb.collection('sets').create({
              workout_exercise: we.id, set_number: j + 1, weight_kg: parseFloat(s.weight), reps: parseInt(s.reps),
            });
          }
        }
      }
      workoutExercises = [];
      tracking = false;
      workoutType = '';
      activeTab = 'workouts';
      await loadWorkouts();
    } catch (error) { console.error('Erreur fin de séance:', error); }
  }

  let streak = $derived(
    (() => {
      if (pastWorkouts.length === 0) return 0;
      const dates = [...new Set(pastWorkouts.map((w: any) => w.date))].sort().reverse();
      let count = 0;
      const today = new Date().toISOString().split('T')[0];
      const checkDate = new Date(today);
      for (const d of dates) {
        const expected = checkDate.toISOString().split('T')[0];
        if (d === expected) { count++; checkDate.setDate(checkDate.getDate() - 1); }
        else if (d < expected) break;
      }
      return count;
    })()
  );

  let workoutsThisWeek = $derived(
    (() => {
      const ws = getWeekStart();
      return pastWorkouts.filter((w: any) => w.date >= ws).length;
    })()
  );

  let calendarDays = $derived(
    (() => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDow = (firstDay.getDay() + 6) % 7;
      const today = now.toISOString().split('T')[0];
      const workoutDates = new Set(pastWorkouts.map((w: any) => w.date));
      const days = [];
      for (let i = 0; i < startDow; i++) days.push({ day: '', inMonth: false, workout: false, isToday: false });
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push({ day: d, inMonth: true, workout: workoutDates.has(dateStr), isToday: dateStr === today });
      }
      return days;
    })()
  );
async function enableNotifications() {
  if (!('Notification' in window)) {
    alert('Ton navigateur ne supporte pas les notifications');
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    // Planifier un rappel à 18h
    scheduleReminder();
  }
}

function scheduleReminder() {
  const now = new Date();
  const reminder = new Date();
  reminder.setHours(18, 0, 0, 0);
  if (reminder < now) reminder.setDate(reminder.getDate() + 1);
  
  const msUntilReminder = reminder.getTime() - now.getTime();
  
  setTimeout(() => {
    sendContractReminder();
    // Reprogrammer pour le lendemain
    setInterval(sendContractReminder, 24 * 60 * 60 * 1000);
  }, msUntilReminder);
}

function sendContractReminder() {
  if (!contract || contract.failed) return;
  
  const remaining = contract.target - contractActual;
  if (remaining <= 0) return;
  
  const endOfWeek = new Date(getWeekStart());
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  const daysLeft = Math.ceil((endOfWeek.getTime() - Date.now()) / 86400000);
  
  let message = '';
  if (daysLeft <= 1) {
    message = `Dernière chance. Il te reste ${remaining} séance${remaining>1?'s':''}.`;
  } else {
    message = `Il te reste ${daysLeft} jours pour ${remaining} séance${remaining>1?'s':''}. Bouge.`;
  }
  
  new Notification('OS-PERSO - Contrat', {
    body: message,
    icon: '/icon-192.png',
  });
}
</script>
<div>
  {#if tracking}
    <div style="margin-bottom: 20px;">
      <h1 style="font-size: 20px; font-weight: 500; color: #F5F5F5;">{workoutTypes.find(w => w.value === workoutType)?.label || workoutType}</h1>
    </div>

    {#each workoutExercises as ex, i}
      <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 14px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h3 style="color: #F5F5F5; font-size: 14px; font-weight: 500;">{ex.name}</h3>
          <button onclick={() => removeExerciseFromWorkout(i)} style="background: none; border: none; color: #595959; cursor: pointer; font-size: 16px;">✕</button>
        </div>
        {#each ex.sets as set, j}
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <span style="color: #595959; font-size: 12px; min-width: 36px;">S{j + 1}</span>
            <input type="number" placeholder="kg" value={set.weight} oninput={(e: any) => updateSet(i, j, 'weight', e.target.value)} style="width: 62px; background: #0D0D0D; border: 1px solid #262626; border-radius: 5px; padding: 7px 8px; font-size: 13px; color: #F5F5F5; outline: none; text-align: center;" />
            <input type="number" placeholder="reps" value={set.reps} oninput={(e: any) => updateSet(i, j, 'reps', e.target.value)} style="width: 50px; background: #0D0D0D; border: 1px solid #262626; border-radius: 5px; padding: 7px 8px; font-size: 13px; color: #F5F5F5; outline: none; text-align: center;" />
            <button onclick={() => removeSet(i, j)} style="background: none; border: none; color: #595959; cursor: pointer; font-size: 12px; padding: 2px 4px;">✕</button>
          </div>
        {/each}
        <button onclick={() => addSet(i)} style="background: transparent; border: 1px dashed #262626; border-radius: 5px; padding: 6px; width: 100%; color: #595959; font-size: 12px; cursor: pointer; margin-top: 2px;">+ Série</button>
      </div>
    {/each}

    <button onclick={() => { searchFilter = ''; showExercisePicker = true; }} style="width: 100%; padding: 12px; background: transparent; border: 1px dashed #262626; border-radius: 8px; color: #8C8C8C; font-size: 14px; cursor: pointer; margin-bottom: 12px;">+ Ajouter un exercice</button>
    <button onclick={finishWorkout} disabled={workoutExercises.length === 0} style="width: 100%; padding: 13px; background: #22C55E; color: #0D0D0D; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; margin-bottom: 8px;">✅ Terminer</button>
    <button onclick={() => tracking = false} style="width: 100%; padding: 10px; background: transparent; color: #EF4444; border: 1px solid #262626; border-radius: 8px; font-size: 14px; cursor: pointer;">Annuler</button>

    {#if showExercisePicker}
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; display: flex; align-items: flex-end; justify-content: center;" onclick={() => showExercisePicker = false}>
        <div style="background: #141414; border: 1px solid #262626; border-radius: 16px 16px 0 0; padding: 20px 16px 32px; width: 100%; max-width: 500px; max-height: 60dvh; overflow-y: auto;" onclick={(e: any) => e.stopPropagation()}>
          <div style="width: 36px; height: 4px; background: #595959; border-radius: 2px; margin: 0 auto 16px;"></div>
          <input type="text" placeholder="Rechercher..." bind:value={searchFilter} style="width: 100%; background: #0D0D0D; border: 1px solid #262626; border-radius: 8px; padding: 12px; font-size: 14px; color: #F5F5F5; outline: none; margin-bottom: 12px; box-sizing: border-box;" />
          {#each pickerExercises as ex}
            <button onclick={() => addExerciseToWorkout(ex)} style="display: flex; justify-content: space-between; width: 100%; padding: 12px 8px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; margin-bottom: 2px; background: transparent; color: #F5F5F5; text-align: left;">
              <span>{ex.name}</span>
              <span style="font-size: 11px; color: #595959;">{groupLabels[ex.muscle_group] || ex.muscle_group}</span>
            </button>
          {/each}
          {#if pickerExercises.length === 0}
            <p style="color: #595959; text-align: center; padding: 20px;">Aucun exercice trouvé</p>
          {/if}
        </div>
      </div>
    {/if}

  {:else}
    <div style="margin-bottom: 20px;">
      <p style="color: #595959; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Gym</p>
      <h1 style="font-size: 20px; font-weight: 500; color: #F5F5F5; margin-top: 2px;">Suivi d'entraînement</h1>
    </div>
    <button onclick={enableNotifications}
  style="width: 100%; padding: 10px; background: #141414; border: 1px solid #262626; border-radius: 8px; color: #8C8C8C; font-size: 13px; cursor: pointer; margin-bottom: 16px;">
  🔔 Activer les rappels de contrat
</button>

    <!-- Contrat -->
    {#if !contract}
      <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 14px; margin-bottom: 16px; text-align: center;">
        <p style="color: #8C8C8C; font-size: 13px; margin-bottom: 8px;">Aucun contrat cette semaine. Tu te fixes un objectif ?</p>
        <button onclick={() => showContractSetup = true} style="background: #3B82F6; color: white; border: none; border-radius: 6px; padding: 8px 16px; font-size: 13px; cursor: pointer;">Définir un contrat</button>
      </div>
    {:else if contractFailed}
      <div style="background: #3A0A0A; border: 1px solid #EF4444; border-radius: 8px; padding: 12px; margin-bottom: 16px; text-align: center;">
        <p style="color: #EF4444; font-size: 14px; font-weight: 600;">CONTRAT ROMPU</p>
        <p style="color: #EF4444; font-size: 12px; margin-top: 4px;">{contractActual}/{contract.target} séances</p>
      </div>
    {:else}
      <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #8C8C8C; font-size: 12px;">Contrat : {contractActual}/{contract.target} séances</span>
          <span style="color: #8C8C8C; font-size: 12px;">{contractProgress}%</span>
        </div>
        <div style="width: 100%; height: 6px; background: #262626; border-radius: 3px; overflow: hidden;">
          <div style="width: {contractProgress}%; height: 100%; background: {contractProgress >= 100 ? '#22C55E' : '#F59E0B'}; border-radius: 3px; transition: width 0.3s;"></div>
        </div>
      </div>
    {/if}

    {#if showContractSetup}
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; display: flex; align-items: center; justify-content: center;" onclick={() => showContractSetup = false}>
        <div style="background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 20px; width: 280px;" onclick={(e: any) => e.stopPropagation()}>
          <p style="color: #F5F5F5; font-size: 15px; font-weight: 500; margin-bottom: 4px;">Contrat de la semaine</p>
          <p style="color: #595959; font-size: 12px; margin-bottom: 12px;">Combien de séances ?</p>
          <div style="display: flex; gap: 8px; margin-bottom: 16px; justify-content: center;">
            {#each [1,2,3,4,5,6] as n}
              <button onclick={() => contractTarget = n} style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid {contractTarget === n ? '#3B82F6' : '#262626'}; background: {contractTarget === n ? '#3B82F6' : 'transparent'}; color: white; font-size: 14px; font-weight: 600; cursor: pointer;">{n}</button>
            {/each}
          </div>
          <button onclick={setupContract} style="width: 100%; padding: 10px; background: #22C55E; color: #0D0D0D; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;">Je m'engage</button>
        </div>
      </div>
    {/if}

    <!-- Tabs -->
    <div style="display: flex; gap: 4px; background: #141414; border-radius: 8px; padding: 4px; border: 1px solid #262626; margin-bottom: 20px;">
      <button onclick={() => switchTab('exercises')} style="flex: 1; padding: 8px; border-radius: 6px; font-size: 13px; border: none; cursor: pointer; {activeTab === 'exercises' ? 'background: #1A1A1A; color: #F5F5F5;' : 'background: transparent; color: #595959;'}">Exercices</button>
      <button onclick={() => switchTab('workouts')} style="flex: 1; padding: 8px; border-radius: 6px; font-size: 13px; border: none; cursor: pointer; {activeTab === 'workouts' ? 'background: #1A1A1A; color: #F5F5F5;' : 'background: transparent; color: #595959;'}">Séances</button>
      <button onclick={() => switchTab('stats')} style="flex: 1; padding: 8px; border-radius: 6px; font-size: 13px; border: none; cursor: pointer; {activeTab === 'stats' ? 'background: #1A1A1A; color: #F5F5F5;' : 'background: transparent; color: #595959;'}">Stats</button>
    </div>

    {#if activeTab === 'exercises'}
      <p style="color: #8C8C8C; font-size: 13px; margin-bottom: 8px;">Type de séance</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px;">
        {#each workoutTypes as wt}
          <button onclick={() => { workoutType = wt.value; startTracking(); }} style="padding: 14px; background: #141414; border: 1px solid #262626; border-radius: 8px; color: #F5F5F5; font-size: 15px; font-weight: 500; cursor: pointer;">{wt.label}</button>
        {/each}
      </div>

      <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
        <p style="color: #595959; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px;">Ajouter à la bibliothèque</p>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <input type="text" placeholder="Nom..." bind:value={newName} disabled={adding} style="flex: 2; min-width: 120px; background: #0D0D0D; border: 1px solid #262626; border-radius: 6px; padding: 8px 10px; font-size: 13px; color: #F5F5F5; outline: none;" />
          <select bind:value={newMuscle} disabled={adding} style="flex: 1; min-width: 100px; background: #0D0D0D; border: 1px solid #262626; border-radius: 6px; padding: 8px; font-size: 13px; color: #F5F5F5; outline: none;">
            {#each muscleGroups as m}<option value={m}>{groupLabels[m] || m}</option>{/each}
          </select>
          <select bind:value={newType} disabled={adding} style="flex: 1; min-width: 90px; background: #0D0D0D; border: 1px solid #262626; border-radius: 6px; padding: 8px; font-size: 13px; color: #F5F5F5; outline: none;">
            {#each exerciseTypes as t}<option value={t}>{t}</option>{/each}
          </select>
          <button onclick={addExercise} disabled={adding || !newName.trim()} style="background: #3B82F6; color: white; border: none; border-radius: 6px; padding: 8px 14px; font-size: 13px; font-weight: 500; cursor: pointer;">Ajouter</button>
        </div>
      </div>

      {#if loading}
        <p style="color: #595959; text-align: center; padding: 32px 0;">Chargement...</p>
      {:else if exercises.length === 0}
        <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 32px; text-align: center;">
          <p style="color: #595959; font-size: 14px;">Aucun exercice. Ajoute ton premier !</p>
        </div>
      {:else}
        {#each Object.entries(grouped) as [group, exs]}
          <div style="margin-bottom: 16px;">
            <h2 style="color: #8C8C8C; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; margin-bottom: 6px; padding: 0 4px;">{groupLabels[group] || group}</h2>
            <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; overflow: hidden;">
              {#each exs as ex, i}
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; {i < exs.length - 1 ? 'border-bottom: 1px solid #262626;' : ''}">
                  <span style="color: #F5F5F5; font-size: 13px;">{ex.name}</span>
                  <span style="color: #595959; font-size: 11px; background: #1A1A1A; padding: 2px 7px; border-radius: 4px;">{ex.type}</span>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      {/if}

    {:else if activeTab === 'workouts'}
      {#if loadingWorkouts}
        <p style="color: #595959; text-align: center; padding: 32px 0;">Chargement...</p>
      {:else if pastWorkouts.length === 0}
        <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 32px; text-align: center;">
          <p style="color: #595959; font-size: 14px;">Aucune séance enregistrée.</p>
          <button onclick={() => switchTab('exercises')} style="margin-top: 12px; background: #3B82F6; color: white; border: none; border-radius: 6px; padding: 8px 16px; font-size: 13px; cursor: pointer;">Démarrer une séance</button>
        </div>
      {:else}
        {#each pastWorkouts as w}
          <button onclick={() => openWorkoutDetail(w)} style="display: block; width: 100%; background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 14px; margin-bottom: 8px; cursor: pointer; text-align: left;">
            <span style="color: #F5F5F5; font-size: 14px; font-weight: 500;">{workoutTypes.find(wt => wt.value === w.muscle_group)?.label || w.muscle_group}</span>
            <span style="color: #595959; font-size: 12px; float: right;">{new Date(w.date).toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </button>
        {/each}
      {/if}

    {:else}
      <div style="margin-bottom: 20px;">
        <p style="color: #595959; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Stats</p>
        <h2 style="font-size: 20px; font-weight: 500; color: #F5F5F5; margin-top: 2px;">Vue d'ensemble</h2>
      </div>

      <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="color: #8C8C8C; font-size: 13px;">Poids corporel</span>
          <span style="color: #F5F5F5; font-size: 13px; font-weight: 500;">
            {#if bodyweights.length > 0}{bodyweights[bodyweights.length - 1].weight} kg{:else}--{/if}
          </span>
        </div>
        <div style="display: flex; align-items: flex-end; gap: 2px; height: 60px;">
          {#if bodyweights.length > 1}
            {#each bodyweights.slice(-14) as bw}
              {@const maxW = Math.max(...bodyweights.slice(-14).map((b: any) => b.weight))}
              {@const minW = Math.min(...bodyweights.slice(-14).map((b: any) => b.weight))}
              {@const range = maxW - minW || 1}
              {@const h = 10 + ((bw.weight - minW) / range) * 40}
              <div style="flex: 1; display: flex; align-items: flex-end; justify-content: center;">
                <div style="width: 60%; height: {h}px; background: #3B82F6; border-radius: 2px 2px 0 0; min-height: 4px;"></div>
              </div>
            {/each}
          {:else}
            <p style="color: #595959; font-size: 12px; width: 100%; text-align: center;">Ajoute ton poids pour voir le graphe</p>
          {/if}
        </div>
        <div style="display: flex; gap: 6px; margin-top: 10px;">
          <input type="number" placeholder="Poids (kg)" bind:value={newWeight} style="flex: 1; background: #0D0D0D; border: 1px solid #262626; border-radius: 6px; padding: 7px 10px; font-size: 13px; color: #F5F5F5; outline: none;" />
          <button onclick={saveWeight} disabled={!newWeight} style="background: #3B82F6; color: white; border: none; border-radius: 6px; padding: 7px 14px; font-size: 13px; cursor: pointer;">Enregistrer</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 14px;">
          <p style="color: #8C8C8C; font-size: 12px; margin-bottom: 4px;">Streak</p>
          <p style="color: #22C55E; font-size: 24px; font-weight: 500;">{streak} jours</p>
        </div>
        <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 14px;">
          <p style="color: #8C8C8C; font-size: 12px; margin-bottom: 4px;">Cette semaine</p>
          <p style="color: #F5F5F5; font-size: 24px; font-weight: 500;">{workoutsThisWeek} séances</p>
        </div>
        <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 14px;">
          <p style="color: #8C8C8C; font-size: 12px; margin-bottom: 4px;">Contrat</p>
          <p style="color: {contractFailed ? '#EF4444' : '#22C55E'}; font-size: 24px; font-weight: 500;">{contract ? contractActual + '/' + contract.target : '--'}</p>
        </div>
        <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 14px;">
          <p style="color: #8C8C8C; font-size: 12px; margin-bottom: 4px;">Total</p>
          <p style="color: #F5F5F5; font-size: 24px; font-weight: 500;">{pastWorkouts.length} séances</p>
        </div>
      </div>

      <div style="background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 16px;">
        <p style="color: #8C8C8C; font-size: 12px; margin-bottom: 10px;">{new Date().toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })}</p>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center;">
          {#each ['L','M','M','J','V','S','D'] as d}
            <span style="color: #595959; font-size: 10px;">{d}</span>
          {/each}
          {#each calendarDays as day}
            <div style="padding: 4px 0; border-radius: 4px; font-size: 11px;
              {day.workout ? 'background: #22C55E; color: #0D0D0D;' : ''}
              {day.isToday ? 'border: 1px solid #3B82F6;' : ''}
              color: {day.workout ? '#0D0D0D' : day.inMonth ? '#8C8C8C' : '#3A3A3A'};">
              {day.day}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}

  {#if selectedWorkout}
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; display: flex; align-items: flex-end; justify-content: center;" onclick={closeDetail}>
      <div style="background: #141414; border: 1px solid #262626; border-radius: 16px 16px 0 0; padding: 20px 16px 32px; width: 100%; max-width: 500px; max-height: 75dvh; overflow-y: auto;" onclick={(e: any) => e.stopPropagation()}>
        <div style="width: 36px; height: 4px; background: #595959; border-radius: 2px; margin: 0 auto 16px;"></div>
        <div style="margin-bottom: 16px;">
          <h2 style="color: #F5F5F5; font-size: 18px; font-weight: 500;">{workoutTypes.find(wt => wt.value === selectedWorkout.muscle_group)?.label || selectedWorkout.muscle_group}</h2>
          <p style="color: #595959; font-size: 13px; margin-top: 2px;">{new Date(selectedWorkout.date).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        {#if loadingDetail}
          <p style="color: #595959; text-align: center; padding: 20px;">Chargement...</p>
        {:else if selectedWorkout.exercises?.length > 0}
          {#each selectedWorkout.exercises as we}
            <div style="background: #0D0D0D; border: 1px solid #262626; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
              <h3 style="color: #F5F5F5; font-size: 14px; font-weight: 500; margin-bottom: 8px;">{we.expand?.exercise?.name || 'Exercice'}</h3>
              <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                {#each (we.sets || []) as set}
                  <span style="background: #1A1A1A; color: #8C8C8C; font-size: 11px; padding: 3px 8px; border-radius: 4px;">{set.weight_kg}kg × {set.reps}</span>
                {/each}
              </div>
            </div>
          {/each}
        {:else}
          <p style="color: #595959; text-align: center; padding: 20px;">Aucun exercice enregistré</p>
        {/if}
        <div style="display: flex; gap: 8px; margin-top: 16px;">
          <button onclick={(e) => deleteWorkout(selectedWorkout, e)} style="flex: 1; padding: 10px; background: transparent; color: #EF4444; border: 1px solid #EF4444; border-radius: 8px; font-size: 14px; cursor: pointer;">🗑 Supprimer</button>
          <button onclick={closeDetail} style="flex: 1; padding: 10px; background: transparent; color: #8C8C8C; border: 1px solid #262626; border-radius: 8px; font-size: 14px; cursor: pointer;">Fermer</button>
        </div>
      </div>
    </div>
  {/if}
</div>