import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Breed } from '@services/types';
import type { CowFilters as Filters } from '@services/cowService';
import { publicService } from '@services/publicService';
import { Input, Select } from '@components/ui/Field';
import { Button } from '@components/ui/Button';
import { PURPOSE_LABELS, UFS } from '@utils/constants';

interface CowFiltersProps {
  value: Filters;
  onChange: (filters: Filters) => void;
  onReset: () => void;
}

export function CowFilters({ value, onChange, onReset }: CowFiltersProps) {
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [draft, setDraft] = useState<Filters>(value);

  useEffect(() => {
    publicService.breeds().then(setBreeds).catch(() => setBreeds([]));
  }, []);

  useEffect(() => setDraft(value), [value]);

  const set = (key: keyof Filters, v: string) => setDraft((d) => ({ ...d, [key]: v }));
  const apply = (next: Filters = draft) => onChange({ ...next, page: 1 });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      aria-label="Filtros"
    >
      <Select
        label="Raça"
        value={draft.breed_id ?? ''}
        onChange={(e) => apply({ ...draft, breed_id: e.target.value })}
        placeholder="Todas as raças"
        options={breeds.map((b) => ({ value: b.id, label: b.name }))}
      />
      <Select
        label="Finalidade"
        value={draft.purpose ?? ''}
        onChange={(e) => apply({ ...draft, purpose: e.target.value })}
        placeholder="Todas"
        options={Object.entries(PURPOSE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
      />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-grafite/90">Faixa de preço (R$)</legend>
        <div className="grid grid-cols-2 gap-2">
          <Input inputMode="numeric" placeholder="Mín." aria-label="Preço mínimo" value={draft.price_min ?? ''} onChange={(e) => set('price_min', e.target.value.replace(/\D/g, ''))} />
          <Input inputMode="numeric" placeholder="Máx." aria-label="Preço máximo" value={draft.price_max ?? ''} onChange={(e) => set('price_max', e.target.value.replace(/\D/g, ''))} />
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-grafite/90">Idade (meses)</legend>
        <div className="grid grid-cols-2 gap-2">
          <Input inputMode="numeric" placeholder="Mín." aria-label="Idade mínima em meses" value={draft.age_min ?? ''} onChange={(e) => set('age_min', e.target.value.replace(/\D/g, ''))} />
          <Input inputMode="numeric" placeholder="Máx." aria-label="Idade máxima em meses" value={draft.age_max ?? ''} onChange={(e) => set('age_max', e.target.value.replace(/\D/g, ''))} />
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-grafite/90">Peso (kg)</legend>
        <div className="grid grid-cols-2 gap-2">
          <Input inputMode="numeric" placeholder="Mín." aria-label="Peso mínimo" value={draft.weight_min ?? ''} onChange={(e) => set('weight_min', e.target.value.replace(/\D/g, ''))} />
          <Input inputMode="numeric" placeholder="Máx." aria-label="Peso máximo" value={draft.weight_max ?? ''} onChange={(e) => set('weight_max', e.target.value.replace(/\D/g, ''))} />
        </div>
      </fieldset>
      <div className="grid grid-cols-[96px_1fr] gap-2">
        <Select
          label="Estado"
          value={draft.state ?? ''}
          onChange={(e) => apply({ ...draft, state: e.target.value })}
          placeholder="UF"
          options={UFS.map((uf) => ({ value: uf, label: uf }))}
        />
        <Input label="Cidade" value={draft.city ?? ''} onChange={(e) => set('city', e.target.value)} placeholder="Ex.: Uberaba" />
      </div>
      <Select
        label="Prenhez"
        value={draft.pregnant ?? ''}
        onChange={(e) => apply({ ...draft, pregnant: e.target.value })}
        placeholder="Indiferente"
        options={[
          { value: '1', label: 'Somente prenhes' },
          { value: '0', label: 'Não prenhes' },
        ]}
      />
      <div className="flex gap-2 pt-1">
        <Button type="submit" block>Aplicar filtros</Button>
        <Button variant="ghost" onClick={onReset} aria-label="Limpar filtros" icon={<RotateCcw className="h-4 w-4" />} />
      </div>
    </form>
  );
}
