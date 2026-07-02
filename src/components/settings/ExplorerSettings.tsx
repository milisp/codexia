import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettingsStore } from '@/stores/settings';

export function ExplorerSettings() {
  const { hiddenNames, addHiddenName, removeHiddenName, resetHiddenNames } = useSettingsStore();
  const [draftHiddenNames, setDraftHiddenNames] = useState('');
  const hasHiddenNames = hiddenNames.length > 0;
  const placeholder = useMemo(() => hiddenNames.join(', '), [hiddenNames]);

  const handleHiddenNamesSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const names = draftHiddenNames
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    if (names.length === 0) {
      return;
    }
    names.forEach((name) => addHiddenName(name));
    setDraftHiddenNames('');
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium px-1">Explorer</h3>
      <Card>
        <CardContent className="p-4 space-y-6">
          <form className="space-y-3" onSubmit={handleHiddenNamesSubmit}>
            <div className="space-y-1">
              <Label htmlFor="hidden-names" className="text-sm font-medium">
                Explorer filters
              </Label>
              <p className="text-xs text-muted-foreground">
                Exclude files or folders by name. Matching is case-insensitive.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="hidden-names"
                className="h-8 text-xs"
                value={draftHiddenNames}
                onChange={(event) => setDraftHiddenNames(event.target.value)}
                placeholder={placeholder || 'node_modules, DS_Store'}
              />
              <Button
                type="submit"
                size="sm"
                className="sm:w-28 h-8 text-xs"
                disabled={!draftHiddenNames.trim()}
              >
                Add
              </Button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2">
            {hasHiddenNames ? (
              hiddenNames.map((name) => (
                <Badge key={name} variant="secondary" className="gap-1 pr-1 text-[10px]">
                  <span className="max-w-[150px] truncate">{name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4"
                    onClick={() => removeHiddenName(name)}
                  >
                    <X className="h-2 w-2" />
                    <span className="sr-only">Remove</span>
                  </Button>
                </Badge>
              ))
            ) : (
              <div className="text-xs text-muted-foreground italic">
                No hidden names configured.
              </div>
            )}
          </div>

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs font-normal"
              onClick={resetHiddenNames}
            >
              Reset defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
