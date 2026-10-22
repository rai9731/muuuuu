import { useRef, useState, type DragEvent } from 'react';
import { FileText, ImagePlus, Video, X } from 'lucide-react';
import { formatFileSize } from '@utils/format';

export interface DropItem {
  key: string;
  /** Arquivo novo (ainda não enviado) */
  file?: File;
  /** Arquivo já salvo no servidor */
  mediaId?: number;
  url: string;
  name: string;
  size: number;
  kind: 'image' | 'video' | 'pdf';
}

interface DropzoneProps {
  label: string;
  hint: string;
  accept: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSizeMb: number;
  items: DropItem[];
  onAdd: (items: DropItem[]) => void;
  onRemove: (item: DropItem) => void;
  onReject: (message: string) => void;
  icon?: 'image' | 'video' | 'pdf';
}

const kindOf = (file: File): DropItem['kind'] =>
  file.type.startsWith('video/') ? 'video' : file.type === 'application/pdf' ? 'pdf' : 'image';

export function Dropzone({ label, hint, accept, multiple = true, maxFiles = 10, maxSizeMb, items, onAdd, onRemove, onReject, icon = 'image' }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const acceptList = accept.split(',').map((a) => a.trim());

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list);
    const accepted: DropItem[] = [];
    for (const file of files) {
      const typeOk = acceptList.some((a) => (a.endsWith('/*') ? file.type.startsWith(a.slice(0, -1)) : file.type === a));
      if (!typeOk) {
        onReject(`"${file.name}" não é um formato permitido.`);
        continue;
      }
      if (file.size > maxSizeMb * 1024 * 1024) {
        onReject(`"${file.name}" passa do limite de ${maxSizeMb} MB.`);
        continue;
      }
      if (items.length + accepted.length >= maxFiles) {
        onReject(`Você pode enviar no máximo ${maxFiles} arquivo${maxFiles > 1 ? 's' : ''} aqui.`);
        break;
      }
      accepted.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
        kind: kindOf(file),
      });
    }
    if (accepted.length) onAdd(multiple ? accepted : accepted.slice(0, 1));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const Icon = icon === 'video' ? Video : icon === 'pdf' ? FileText : ImagePlus;

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-grafite/90">{label}</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
          dragging ? 'border-folha bg-folha/10' : 'border-pasto/25 bg-white/40 hover:border-folha hover:bg-white/60'
        }`}
      >
        <Icon className="h-8 w-8 text-pasto" aria-hidden />
        <span className="mt-2 text-sm font-semibold text-grafite">Arraste e solte aqui ou clique para escolher</span>
        <span className="mt-1 text-xs text-grafite/60">{hint}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {items.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item, index) => (
            <li key={item.key} className="glass group relative overflow-hidden rounded-2xl">
              {item.kind === 'image' ? (
                <img src={item.url} alt={item.name} className="aspect-[4/3] w-full object-cover" />
              ) : item.kind === 'video' ? (
                <video src={item.url} className="aspect-[4/3] w-full bg-black object-cover" muted />
              ) : (
                <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 p-2">
                  <FileText className="h-8 w-8 text-terra" aria-hidden />
                </div>
              )}
              <div className="px-2 py-1.5">
                <p className="truncate text-xs font-medium text-grafite" title={item.name}>{item.name}</p>
                <p className="text-[11px] text-grafite/55">
                  {formatFileSize(item.size)}
                  {item.kind === 'image' && index === 0 && multiple ? ' · Capa' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(item)}
                className="absolute right-1.5 top-1.5 rounded-full bg-grafite/70 p-1 text-white transition hover:bg-red-600"
                aria-label={`Remover ${item.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
