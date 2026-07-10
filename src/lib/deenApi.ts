import pb from '$lib/pocketbase';

// Types
export interface Surah { id: string; number: number; name: string; pages: number; }
export interface Prayer { id: string; date: string; fajr: string; dohr: string; asr: string; maghrib: string; isha: string; chaf: string; witr: string; fajr_wakeup: string; }
export interface Memorization { id: string; surah: string; pages_memorized?: number; memorized?: boolean; last_reviewed: string; }
export interface Topic { id: string; category: string; name: string; active: boolean; }
export interface Prophet { id: string; name: string; status: string; }
export interface Companion { id: string; name: string; status: string; }
export interface Objective { id: string; title: string; type: string; target: number; current: number; done: boolean; }

// Prières
export async function loadPrayers(year: number, month: number) {
  const m = String(month + 1).padStart(2, '0');
  const start = `${year}-${m}-01`;
  const end = `${year}-${m}-31`;
  return await pb.collection('prayers').getFullList({
    filter: `date >= "${start}" && date <= "${end}"`,
    sort: 'date',
  });
}

export async function savePrayer(date: string, field: string, value: string) {
  const existing = await pb.collection('prayers').getFullList({ filter: `date = "${date}"` });
  if (existing.length > 0) {
    return await pb.collection('prayers').update(existing[0].id, { [field]: value });
  } else {
    return await pb.collection('prayers').create({ date, [field]: value });
  }
}

// Coran
export async function loadSurahs() {
  return await pb.collection('surahs').getFullList({ sort: 'number' });
}

export async function loadMemorization() {
  return await pb.collection('memorization').getFullList();
}

export async function addMemorization(surahId: string, pages: number, today: string) {
  const existing = await pb.collection('memorization').getFullList({ filter: `surah = "${surahId}"` });
  if (existing.length > 0) {
    return await pb.collection('memorization').update(existing[0].id, {
      pages_memorized: (existing[0].pages_memorized || 0) + pages,
      last_reviewed: today,
    });
  } else {
    return await pb.collection('memorization').create({
      surah: surahId, pages_memorized: pages, last_reviewed: today,
    });
  }
}

// Thématiques
export async function loadTopics() {
  return await pb.collection('topics').getFullList();
}

export async function toggleTopic(id: string, active: boolean) {
  return await pb.collection('topics').update(id, { active });
}

// Prophètes & Compagnons
export async function loadProphets() {
  return await pb.collection('prophets').getFullList({ sort: 'name' });
}

export async function loadCompanions() {
  return await pb.collection('companions').getFullList({ sort: 'name' });
}

export async function setStatus(collection: string, id: string, status: string) {
  return await pb.collection(collection).update(id, { status });
}

// Objectifs
export async function loadObjectives() {
  return await pb.collection('deed_objectives').getFullList();
}

export async function createObjective(data: { title: string; type: string; target: number }) {
  return await pb.collection('deed_objectives').create({ ...data, current: 0, done: false });
}

export async function updateObjective(id: string, data: { current?: number; done?: boolean }) {
  return await pb.collection('deed_objectives').update(id, data);
}

export async function deleteObjective(id: string) {
  return await pb.collection('deed_objectives').delete(id);
}
export async function toggleMemorized(surahId: string, memorized: boolean, today: string) {
  const existing = await pb.collection('memorization').getFullList({ filter: `surah = "${surahId}"` });
  if (existing.length > 0) {
    return await pb.collection('memorization').update(existing[0].id, { memorized, last_reviewed: today });
  } else {
    return await pb.collection('memorization').create({ surah: surahId, memorized, last_reviewed: today });
  }
}