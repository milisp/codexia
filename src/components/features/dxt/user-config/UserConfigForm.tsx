import { Folder } from 'lucide-react';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FolderSelector } from '../FolderSelector';
import type { DxtUserConfigurationOptionSchema } from '../schemas';

// Generic input renderer for different types
function ConfigInput({
  type,
  value,
  option,
  onChange,
}: {
  type: string;
  value: any;
  option: z.infer<typeof DxtUserConfigurationOptionSchema>;
  onChange: (val: any) => void;
  idx?: number;
  name?: string;
}) {
  switch (type) {
    case 'string':
      return (
        <Input
          type={option.sensitive ? 'password' : 'text'}
          placeholder={option.description}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'number':
      return (
        <Input
          type="number"
          placeholder={option.description}
          value={value ?? ''}
          min={option.min}
          max={option.max}
          onChange={(e) => onChange(e.target.valueAsNumber)}
        />
      );
    case 'directory':
      return (
        <FolderSelector
          value={value ?? ''}
          onChange={onChange}
          placeholder={option.description + ' (directory path)'}
        />
      );
    case 'file':
      return (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder={option.description + ' (file path)'}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
          {/* TODO: Implement file picker logic */}
          <Button size="icon" variant="ghost" onClick={() => {}}>
            <Folder />
          </Button>
        </div>
      );
    default:
      return null;
  }
}

// Form field for user config
function UserConfigField({
  name,
  option,
  value,
  onChange,
}: {
  name: string;
  option: z.infer<typeof DxtUserConfigurationOptionSchema>;
  value: any;
  onChange: (name: string, value: any) => void;
}) {
  // Helper for red dot
  const RequiredDot = option.required ? (
    <span title="Required" className="ml-1 text-red-500 align-middle">
      *
    </span>
  ) : null;

  // Helper for multiple values
  if (option.multiple) {
    const values: any[] = Array.isArray(value) ? value : [];
    const addLabel =
      option.type === 'directory'
        ? 'Add Directory'
        : option.type === 'file'
          ? 'Add file'
          : 'Add value';
    return (
      <div className="mb-2">
        <label className="block font-medium mb-1">
          {option.title}
          {RequiredDot}
        </label>
        {values.length === 0 && (
          <div className="flex items-center gap-2 mb-1">
            <ConfigInput
              type={option.type}
              value={''}
              option={option}
              onChange={(v) => onChange(name, [v])}
              name={name}
            />
          </div>
        )}
        {values.map((v, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-1">
            <ConfigInput
              type={option.type}
              value={v}
              option={option}
              onChange={(val) => {
                const newArr = [...values];
                newArr[idx] = val;
                onChange(name, newArr);
              }}
              idx={idx}
              name={name}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="Remove"
              onClick={() => {
                const newArr = values.filter((_, i) => i !== idx);
                onChange(name, newArr);
              }}
            >
              ×
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(name, [...values, option.type === 'number' ? 0 : ''])}
        >
          {addLabel}
        </Button>
      </div>
    );
  }

  // Single value fields
  switch (option.type) {
    case 'string':
    case 'number':
    case 'directory':
    case 'file':
      return (
        <div className="mb-2">
          <label className="block font-medium mb-1">
            {option.title}
            {RequiredDot}
          </label>
          <ConfigInput
            type={option.type}
            value={value}
            option={option}
            onChange={(v) => onChange(name, v)}
            name={name}
          />
        </div>
      );
    case 'boolean':
      return (
        <div className="mb-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(name, e.target.checked)}
          />
          <label>
            {option.title}
            {RequiredDot}
          </label>
        </div>
      );
    default:
      return null;
  }
}

export function UserConfigForm({
  schema,
  values,
  onChange,
}: {
  schema: Record<string, z.infer<typeof DxtUserConfigurationOptionSchema>>;
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
}) {
  return (
    // Make the form take full width with padding
    <form className="w-full grid grid-cols-1 gap-4">
      {Object.entries(schema).map(([key, option]) => (
        <UserConfigField
          key={key}
          name={key}
          option={option as z.infer<typeof DxtUserConfigurationOptionSchema>}
          value={values[key]}
          onChange={onChange}
        />
      ))}
    </form>
  );
}
