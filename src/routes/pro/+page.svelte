<script lang="ts">
  import { onMount } from 'svelte';
  import {
    loadProjects, createProject, archiveProject,
    startSession, stopSession, getActiveSession,
    type Project, type Session
  } from '$lib/proApi';

  let projects: Project[] = $state([]);
  let activeSessions: Record<string, Session | null> = $state({});
  let showNewProject = $state(false);
  let newProjectName = $state('');
  let showArchived = $state(false);
  let archivedProjects: Project[] = $state([]);

  onMount(() => { loadAll(); });

  async function loadAll() {
    const all = await loadProjects();
    projects = all.filter(p => p.status === 'active');
    archivedProjects = all.filter(p => p.status === 'archived');
    for (const p of projects) {
      activeSessions[p.id] = await getActiveSession(p.id);
    }
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;
    await createProject(newProjectName.trim());
    newProjectName = '';
    showNewProject = false;
    await loadAll();
  }

  async function handleArchive(project: Project) {
    if (!confirm(`Archiver "${project.name}" ?`)) return;
    await archiveProject(project.id);
    await loadAll();
  }

  async function handleToggleSession(project: Project) {
    const active = activeSessions[project.id];
    if (active) {
      await stopSession(active.id);
      activeSessions[project.id] = null;
    } else {
      const session = await startSession(project.id);
      activeSessions[project.id] = session;
    }
  }

  function opacity(project: Project): number {
    const updated = new Date(project.updated);
    const days = (Date.now() - updated.getTime()) / 86400000;
    if (days <= 3) return 1;
    if (days <= 10) return 0.6;
    return 0.3;
  }

  function formatDuration(minutes: number | null): string {
    if (!minutes) return 'En cours';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h${m > 0 ? m : ''}`;
  }

  function timeSince(date: string): string {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Hier";
    return `Il y a ${days} jours`;
  }
</script>

<div>
  <div style="margin-bottom: 20px;">
    <p style="color: #595959; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Pro</p>
    <h1 style="font-size: 20px; font-weight: 500; color: #F5F5F5; margin-top: 2px;">Projets</h1>
  </div>

  {#if projects.length === 0}
    <div style="background: #141414; border: 1px solid #262626; border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 16px;">
      <p style="color: #8C8C8C; font-size: 14px; margin-bottom: 12px;">Aucun projet actif.</p>
      <button onclick={() => showNewProject = true}
        style="background: #3B82F6; color: white; border: none; border-radius: 6px; padding: 10px 20px; font-size: 13px; cursor: pointer;">
        + Nouveau projet
      </button>
    </div>
  {:else}
    {#each projects as project}
      <div
        style="background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 18px; margin-bottom: 12px; opacity: {opacity(project)}; transition: opacity 0.3s;"
      >
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <h2 style="color: #F5F5F5; font-size: 16px; font-weight: 500; margin-bottom: 4px;">{project.name}</h2>
            <p style="color: #595959; font-size: 11px;">Dernière activité : {timeSince(project.updated)}</p>
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 12px;">
          <button onclick={() => handleToggleSession(project)}
            style="flex: 1; padding: 10px; border-radius: 8px; border: none; font-size: 13px; font-weight: 500; cursor: pointer;
              {activeSessions[project.id] ? 'background: #EF4444; color: white;' : 'background: #22C55E; color: #0D0D0D;'}">
            {activeSessions[project.id] ? '⏹ Arrêter' : '▶ Démarrer'}
          </button>
          <button onclick={() => handleArchive(project)}
            style="padding: 10px 14px; background: transparent; border: 1px solid #262626; border-radius: 8px; color: #595959; font-size: 13px; cursor: pointer;">
            📦 Archiver
          </button>
        </div>

        {#if activeSessions[project.id]}
          <div style="margin-top: 8px; display: flex; align-items: center; gap: 6px;">
            <span style="width: 8px; height: 8px; background: #22C55E; border-radius: 50%; animation: pulse 1.5s infinite;"></span>
            <span style="color: #22C55E; font-size: 11px;">Session en cours</span>
          </div>
        {/if}
      </div>
    {/each}
  {/if}

  {#if projects.length < 3}
    <button onclick={() => showNewProject = true}
      style="width: 100%; padding: 12px; background: transparent; border: 1px dashed #262626; border-radius: 8px; color: #8C8C8C; font-size: 14px; cursor: pointer; margin-bottom: 12px;">
      + Nouveau projet ({projects.length}/3)
    </button>
  {/if}

  <button onclick={() => showArchived = true}
    style="width: 100%; padding: 10px; background: transparent; border: 1px solid #262626; border-radius: 8px; color: #595959; font-size: 13px; cursor: pointer;">
    📦 Voir les archives ({archivedProjects.length})
  </button>

  <!-- Modal nouveau projet -->
  {#if showNewProject}
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px;" onclick={() => showNewProject = false}>
      <div style="background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 20px; width: 100%; max-width: 350px;" onclick={(e: any) => e.stopPropagation()}>
        <h2 style="color: #F5F5F5; font-size: 16px; font-weight: 500; margin-bottom: 12px;">Nouveau projet</h2>
        <input type="text" placeholder="Nom du projet" bind:value={newProjectName}
          style="width: 100%; background: #0D0D0D; border: 1px solid #262626; border-radius: 6px; padding: 10px; font-size: 14px; color: #F5F5F5; outline: none; margin-bottom: 12px; box-sizing: border-box;" />
        <div style="display: flex; gap: 8px;">
          <button onclick={() => showNewProject = false}
            style="flex: 1; padding: 8px; background: transparent; border: 1px solid #262626; border-radius: 6px; color: #8C8C8C; font-size: 13px; cursor: pointer;">Annuler</button>
          <button onclick={handleCreateProject} disabled={!newProjectName.trim()}
            style="flex: 1; padding: 8px; background: #3B82F6; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">Créer</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Modal archives -->
  {#if showArchived}
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; display: flex; align-items: flex-end; justify-content: center;" onclick={() => showArchived = false}>
      <div style="background: #141414; border: 1px solid #262626; border-radius: 16px 16px 0 0; padding: 20px 16px 32px; width: 100%; max-width: 500px; max-height: 70dvh; overflow-y: auto;" onclick={(e: any) => e.stopPropagation()}>
        <div style="width: 36px; height: 4px; background: #595959; border-radius: 2px; margin: 0 auto 16px;"></div>
        <h2 style="color: #F5F5F5; font-size: 16px; font-weight: 500; margin-bottom: 16px;">Projets archivés</h2>
        {#if archivedProjects.length === 0}
          <p style="color: #595959; text-align: center; padding: 20px;">Aucun projet archivé</p>
        {:else}
          {#each archivedProjects as p}
            <div style="padding: 12px; background: #0D0D0D; border: 1px solid #262626; border-radius: 8px; margin-bottom: 8px;">
              <span style="color: #F5F5F5; font-size: 14px;">{p.name}</span>
            </div>
          {/each}
        {/if}
        <button onclick={() => showArchived = false}
          style="width: 100%; margin-top: 12px; padding: 10px; background: transparent; color: #8C8C8C; border: 1px solid #262626; border-radius: 8px; font-size: 14px; cursor: pointer;">Fermer</button>
      </div>
    </div>
  {/if}
</div>

<style>
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
</style>