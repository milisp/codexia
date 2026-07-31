import { dual, dualGet, dualVoid } from './shared';

export async function loadManifests() {
  return await dualGet<unknown[]>('load_manifests', undefined, '/api/dxt/manifests');
}

export async function loadManifest(user: string, repo: string) {
  return await dual<unknown | null>('load_manifest', { user, repo }, '/api/dxt/manifest', {
    user,
    repo,
  });
}

export async function checkManifestsExist() {
  return await dualGet<boolean>('check_manifests_exist', undefined, '/api/dxt/manifests/exist');
}

export async function downloadAndExtractManifests() {
  await dualVoid('download_and_extract_manifests', undefined, '/api/dxt/manifests/download');
}

export async function readDxtSetting(user: string, repo: string) {
  return await dual<unknown>('read_dxt_setting', { user, repo }, '/api/dxt/setting/read', {
    user,
    repo,
  });
}

export async function saveDxtSetting(user: string, repo: string, content: unknown) {
  await dualVoid('save_dxt_setting', { user, repo, content }, '/api/dxt/setting/save', {
    user,
    repo,
    content,
  });
}
