import { LazyStore } from "@tauri-apps/plugin-store";

const store = new LazyStore("settings.json");

const KEYS = {
  paths: "orbitPaths",
  excluded: "excludedPaths",
  projectOrder: "projectOrder",
  preferredIdes: "preferredIdes",
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const ensureObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

export async function loadOrbitSettings() {
  const [paths, excluded, projectOrder, preferredIdes] = await Promise.all([
    store.get(KEYS.paths),
    store.get(KEYS.excluded),
    store.get(KEYS.projectOrder),
    store.get(KEYS.preferredIdes),
  ]);

  return {
    paths: ensureArray(paths),
    excluded: ensureArray(excluded),
    projectOrder: ensureArray(projectOrder),
    preferredIdes: ensureObject(preferredIdes),
  };
}

export async function saveOrbitSettings(partial) {
  const pending = [];

  if (Object.prototype.hasOwnProperty.call(partial, "paths")) {
    pending.push(store.set(KEYS.paths, partial.paths));
  }

  if (Object.prototype.hasOwnProperty.call(partial, "excluded")) {
    pending.push(store.set(KEYS.excluded, partial.excluded));
  }

  if (Object.prototype.hasOwnProperty.call(partial, "projectOrder")) {
    pending.push(store.set(KEYS.projectOrder, partial.projectOrder));
  }

  if (Object.prototype.hasOwnProperty.call(partial, "preferredIdes")) {
    pending.push(store.set(KEYS.preferredIdes, partial.preferredIdes));
  }

  if (pending.length === 0) {
    return;
  }

  await Promise.all(pending);
  await store.save();
}
