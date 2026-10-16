import { getJson, postJson } from './shared';

export type CustomModel = {
  id: string;
  name: string;
};

export type CustomModelsByProvider = Record<string, CustomModel[]>;

// Every call returns the full backend list so clients converge on one state.
export function listCustomModels() {
  return getJson<CustomModelsByProvider>('/api/custom-models');
}

export function addCustomModel(provider: string, model: CustomModel) {
  return postJson<CustomModelsByProvider>('/api/custom-models/add', {
    provider,
    id: model.id,
    name: model.name,
  });
}

export function removeCustomModel(provider: string, id: string) {
  return postJson<CustomModelsByProvider>('/api/custom-models/remove', { provider, id });
}
