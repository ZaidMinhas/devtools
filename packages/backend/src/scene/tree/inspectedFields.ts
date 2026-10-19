import { getInspectEnumEntries, getInspectFields } from '@pixi/devtools';
import type { PropertiesEntry } from '@pixi/devtools';

// Keep custom field writes separate from built-in properties and extension handlers.
const propertyPrefix = '__inspect__:';

export function getInspectedProperties(target: object): PropertiesEntry[] {
  const properties: PropertiesEntry[] = [];
  for (const [name, options] of getInspectFields(target)) {
    const value: unknown = Reflect.get(target, name);
    const type = typeof value;
    if (type !== 'number' && type !== 'string' && type !== 'boolean') continue;
    if (type === 'number' && !Number.isFinite(value)) continue;

    const entries = options.enum ? getInspectEnumEntries(options.enum) : undefined;
    if (entries && entries.length === 0) continue;
    properties.push({
      prop: propertyPrefix + name,
      value: entries ? entries.find(([, enumValue]) => enumValue === value)?.[0] ?? '' : value,
      entry: {
        section: options.section ?? 'Custom Fields',
        label: options.label ?? name,
        tooltip: options.tooltip,
        type: entries ? 'select' : type === 'string' ? 'text' : (type as 'number' | 'boolean'),
        options: entries
          ? { options: entries.map(([label]) => label) }
          : type === 'number'
            ? { min: options.min, max: options.max, step: options.step ?? 'any' }
            : undefined,
      },
    });
  }
  return properties;
}

/** Returns true for custom-field requests, including invalid writes that must not fall through. */
export function setInspectedProperty(target: object, prop: string, value: unknown): boolean {
  if (!prop.startsWith(propertyPrefix)) return false;
  const name = prop.slice(propertyPrefix.length);
  const options = getInspectFields(target).get(name);
  if (!options) return true;

  const current: unknown = Reflect.get(target, name);
  if (options.enum) {
    const entry = getInspectEnumEntries(options.enum).find(([label]) => label === value);
    if (entry) Reflect.set(target, name, entry[1]);
    return true;
  }

  if (typeof current !== typeof value) return true;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return true;
    if (options.min !== undefined && value < options.min) return true;
    if (options.max !== undefined && value > options.max) return true;
  } else if (typeof value !== 'string' && typeof value !== 'boolean') {
    return true;
  }
  Reflect.set(target, name, value);
  return true;
}
