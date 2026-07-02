import { motion } from 'framer-motion';
import { Check, Settings2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ModelPricing } from './constants';
import { DEFAULT_MODEL_PRICING } from './utils';

interface PricingEditorProps {
  pricing: Record<string, ModelPricing>;
  onSave: (p: Record<string, ModelPricing>) => void;
  onClose: () => void;
}

export function PricingEditor({ pricing, onSave, onClose }: PricingEditorProps) {
  const [local, setLocal] = useState<Record<string, ModelPricing>>(() =>
    Object.fromEntries(Object.entries(pricing).filter(([k]) => !k.startsWith('_')))
  );
  const [newKey, setNewKey] = useState('');

  function setField(key: string, field: keyof ModelPricing, raw: string) {
    const val = parseFloat(raw);
    if (isNaN(val)) return;
    setLocal((p) => ({ ...p, [key]: { ...p[key], [field]: val } }));
  }

  function addModel() {
    const k = newKey.trim().toLowerCase();
    if (!k || local[k]) return;
    setLocal((p) => ({ ...p, [k]: { input: 0, output: 0, cache_read: 0, cache_creation: 0 } }));
    setNewKey('');
  }

  function removeModel(key: string) {
    setLocal((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
  }

  function handleSave() {
    const merged: Record<string, ModelPricing> = {};
    for (const [k, v] of Object.entries(pricing)) {
      if (k.startsWith('_')) merged[k] = v;
    }
    Object.assign(merged, local);
    onSave(merged);
    onClose();
  }

  function handleReset() {
    setLocal(
      Object.fromEntries(Object.entries(DEFAULT_MODEL_PRICING).filter(([k]) => !k.startsWith('_')))
    );
  }

  const cols: (keyof ModelPricing)[] = ['input', 'output', 'cache_read', 'cache_creation'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-200">Model Pricing</h2>
            <span className="text-xs text-slate-500">per 1M tokens (USD)</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-auto max-h-[60vh] px-5 py-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-2 pr-3 font-medium">Model key</th>
                {cols.map((c) => (
                  <th key={c} className="pb-2 pr-2 font-medium capitalize w-24">
                    {c.replace('_', ' ')}
                  </th>
                ))}
                <th className="pb-2 w-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {Object.entries(local).map(([key, p]) => (
                <tr key={key} className="group">
                  <td className="py-1.5 pr-3 font-mono text-slate-300 align-middle">{key}</td>
                  {cols.map((c) => (
                    <td key={c} className="py-1.5 pr-2 align-middle">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        defaultValue={p[c]}
                        onBlur={(e) => setField(key, c, e.target.value)}
                        className="w-full rounded-md bg-slate-800 px-2 py-1 font-mono text-xs text-slate-200 border border-slate-700 focus:outline-none focus:border-slate-500"
                      />
                    </td>
                  ))}
                  <td className="py-1.5 align-middle">
                    <button
                      onClick={() => removeModel(key)}
                      className="invisible group-hover:visible text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-800 px-5 py-3 flex items-center gap-2">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addModel()}
            placeholder="Add model key (e.g. gpt-5)"
            className="flex-1 rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-200 border border-slate-700 focus:outline-none focus:border-slate-500 placeholder:text-slate-600"
          />
          <Button size="sm" variant="secondary" onClick={addModel} className="h-7 text-xs">
            Add
          </Button>
        </div>

        <div className="border-t border-slate-800 px-5 py-3 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Reset to defaults
          </button>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-7 text-xs text-slate-400"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-7 text-xs bg-violet-600 hover:bg-violet-500 text-white gap-1"
            >
              <Check className="h-3 w-3" /> Save
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
