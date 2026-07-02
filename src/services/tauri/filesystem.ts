import {
  getJson,
  invokeTauri,
  isDesktopTauri,
  postJson,
  postJsonWithOptions,
  postNoContent,
} from './shared';

export async function readFile(filePath: string, options?: { suppressToast?: boolean }) {
  if (isDesktopTauri()) {
    return await invokeTauri<string>('read_file', { filePath });
  }
  return await postJsonWithOptions<string>('/api/filesystem/read-file', { filePath }, options);
}

export async function readTextFileLines(filePath: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<string[]>('read_text_file_lines', { filePath });
  }
  return await postJson<string[]>('/api/filesystem/read-text-file-lines', { filePath });
}

export async function getCodexHome() {
  if (isDesktopTauri()) {
    return await invokeTauri<string>('codex_home');
  }
  return await getJson<string>('/api/filesystem/codex-home');
}

export async function writeFile(filePath: string, content: string) {
  if (isDesktopTauri()) {
    await invokeTauri('write_file', { filePath, content });
    return;
  }
  await postNoContent('/api/filesystem/write-file', { filePath, content });
}

export async function readPdfContent(filePath: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<string>('read_pdf_content', { filePath });
  }
  return await postJson<string>('/api/filesystem/read-pdf', { filePath });
}

export async function readXlsxContent(filePath: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<string>('read_xlsx_content', { filePath });
  }
  return await postJson<string>('/api/filesystem/read-xlsx', { filePath });
}

export async function readDirectory(path: string, options?: { suppressToast?: boolean }) {
  if (isDesktopTauri()) {
    return await invokeTauri<Array<import('./shared').TauriFileEntry>>('read_directory', { path });
  }
  return await postJsonWithOptions<Array<import('./shared').TauriFileEntry>>(
    '/api/filesystem/read-directory',
    { path },
    options
  );
}

export async function getHomeDirectory() {
  if (isDesktopTauri()) {
    return await invokeTauri<string>('get_home_directory');
  }
  return await getJson<string>('/api/filesystem/home-directory');
}

export async function searchFiles(params: {
  root: string;
  query: string;
  excludeFolders: string[];
  maxResults?: number;
}) {
  if (isDesktopTauri()) {
    return await invokeTauri<Array<import('./shared').TauriFileEntry>>('search_files', params);
  }
  return await postJson<Array<import('./shared').TauriFileEntry>>('/api/filesystem/search-files', {
    root: params.root,
    query: params.query,
    exclude_folders: params.excludeFolders,
    max_results: params.maxResults,
  });
}

export async function searchFilesByName(params: {
  root: string;
  query: string;
  excludeFolders: string[];
  maxResults?: number;
}) {
  if (isDesktopTauri()) {
    return await invokeTauri<Array<import('./shared').TauriFileEntry>>(
      'search_files_by_name',
      params
    );
  }
  return await postJson<Array<import('./shared').TauriFileEntry>>(
    '/api/filesystem/search-files-by-name',
    {
      root: params.root,
      query: params.query,
      exclude_folders: params.excludeFolders,
      max_results: params.maxResults,
    }
  );
}

export async function canonicalizePath(path: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<string>('canonicalize_path', { path });
  }
  return await postJson<string>('/api/filesystem/canonicalize-path', { path });
}

export async function deleteFile(filePath: string) {
  if (isDesktopTauri()) {
    await invokeTauri('delete_file', { filePath });
    return;
  }
  await postNoContent('/api/filesystem/delete-file', { filePath });
}

export async function watchDirectory(folderPath: string) {
  if (isDesktopTauri()) {
    await invokeTauri('watch_directory', { folderPath });
    return;
  }
  await postNoContent('/api/filesystem/watch', { path: folderPath });
}

export async function unwatchDirectory(folderPath: string) {
  if (isDesktopTauri()) {
    await invokeTauri('unwatch_directory', { folderPath });
    return;
  }
  await postNoContent('/api/filesystem/unwatch', { path: folderPath });
}
