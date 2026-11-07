import { useRef, useState, type DragEvent, type ReactNode } from 'react';

/** Accept local files without interfering with photo reordering or text drags. */
export function PhotoDropZone({ children, onFiles, disabled = false }: {
  children: ReactNode;
  onFiles: (files: FileList) => void;
  disabled?: boolean;
}) {
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes('Files');

  return (
    <div
      aria-busy={disabled}
      className={`rounded-md border border-dashed p-3 transition-colors ${over && !disabled ? 'border-pink bg-pink/10' : 'border-edge'}`}
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
      }}
      onDragLeave={(event) => {
        if (!hasFiles(event)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setOver(false);
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.stopPropagation();
        depth.current = 0;
        setOver(false);
        if (!disabled) onFiles(event.dataTransfer.files);
      }}
    >
      {children}
      <p className="mt-2 text-[11px] text-muted">
        {over && !disabled ? 'Drop photos here to upload.' : 'Drag and drop photos here, or use the upload button.'}
      </p>
    </div>
  );
}
