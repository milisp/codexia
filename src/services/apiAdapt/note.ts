import { type DbNote, dual, dualVoid } from './shared';

export async function createNote(
  id: string,
  title: string,
  content: string,
  tags?: string[],
  userId?: string | null
) {
  return await dual<DbNote>(
    'create_note',
    { id, userId, title, content, tags },
    '/api/notes/create',
    {
      id,
      user_id: userId ?? null,
      title,
      content,
      tags: tags ?? null,
    }
  );
}

export async function getNotes(userId?: string | null) {
  return await dual<DbNote[]>('get_notes', { userId }, '/api/notes/list', {
    user_id: userId ?? null,
  });
}

export async function getNoteById(id: string) {
  return await dual<DbNote | null>('get_note_by_id', { id }, '/api/notes/get', { id });
}

export async function updateNote(
  id: string,
  payload: { title?: string; content?: string; tags?: string[] }
) {
  await dualVoid('update_note', { id, ...payload }, '/api/notes/update', { id, ...payload });
}

export async function deleteNote(id: string) {
  await dualVoid('delete_note', { id }, '/api/notes/delete', { id });
}

export async function toggleFavorite(id: string) {
  await dualVoid('toggle_favorite', { id }, '/api/notes/toggle-favorite', { id });
}

export async function markNotesSynced(ids: string[]) {
  await dualVoid('mark_notes_synced', { ids }, '/api/notes/mark-synced', { ids });
}

export async function getUnsyncedNotes(userId?: string | null) {
  return await dual<DbNote[]>('get_unsynced_notes', { userId }, '/api/notes/unsynced', {
    user_id: userId ?? null,
  });
}
