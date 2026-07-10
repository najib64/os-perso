import pb from '$lib/pocketbase';

export interface Project { id: string; name: string; status: string; created: string; updated: string; }
export interface Session { id: string; project: string; started_at: string; ended_at: string | null; duration_minutes: number | null; }

export async function loadProjects() {
  return await pb.collection('projects').getFullList({ sort: 'created' });
}

export async function createProject(name: string) {
  return await pb.collection('projects').create({ name, status: 'active' });
}

export async function archiveProject(id: string) {
  return await pb.collection('projects').update(id, { status: 'archived' });
}

export async function loadSessions(projectId: string) {
  return await pb.collection('sessions').getFullList({
    filter: `project = "${projectId}"`,
    sort: '-started_at',
  });
}

export async function startSession(projectId: string) {
  return await pb.collection('sessions').create({
    project: projectId,
    started_at: new Date().toISOString(),
  });
}

export async function stopSession(sessionId: string) {
  const now = new Date();
  const session = await pb.collection('sessions').getOne(sessionId);
  const start = new Date(session.started_at);
  const duration = Math.round((now.getTime() - start.getTime()) / 60000);
  return await pb.collection('sessions').update(sessionId, {
    ended_at: now.toISOString(),
    duration_minutes: duration,
  });
}

export async function getActiveSession(projectId: string): Promise<Session | null> {
  const sessions = await pb.collection('sessions').getFullList({
    filter: `project = "${projectId}" && ended_at = null`,
  });
  if (sessions.length > 0) {
    return {
      id: sessions[0].id,
      project: sessions[0].project,
      started_at: sessions[0].started_at,
      ended_at: sessions[0].ended_at,
      duration_minutes: sessions[0].duration_minutes,
    } as Session;
  }
  return null;
}