import { memo, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { ArrowUp, Bell, Check, ClipboardCheck, FileText, Trash2 } from 'lucide-react';
import type { BrainNote, Category, NoteFormat } from '@/types';
import { useNotesStore } from '@/stores/notes';
import { useBrainStore } from '@/stores/brain';
import { useOpsStore } from '@/stores/ops';
import { useUIStore } from '@/stores/ui';
import { guessCategory } from '@/lib/ai';
import { suggestLinks } from '@/lib/graph';
import { CATEGORY_META, cn } from '@/lib/utils';

const FORMATS: { id: NoteFormat; label: string }[] = [
  { id: 'note', label: 'Note' },
  { id: 'todo', label: 'To-do' },
  { id: 'reminder', label: 'Reminder' },
  { id: 'commitment', label: 'Commitment' },
];

const CATEGORY_ORDER: Category[] = ['business', 'music', 'health', 'travel', 'family', 'ideas', 'personal'];

interface Flight {
  title: string;
  category: Category;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export function NotesView() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1380px] px-6 pb-16 pt-6">
        <CaptureDeck />
        <Shelf />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Capture deck                                                        */
/* ------------------------------------------------------------------ */

function CaptureDeck() {
  const [text, setText] = useState('');
  const [fmt, setFmt] = useState<NoteFormat>('note');
  const [catOverride, setCatOverride] = useState<Category | null>(null);
  const [remindDate, setRemindDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [remindTime, setRemindTime] = useState('09:00');
  const [flight, setFlight] = useState<Flight | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);

  const autoCategory = useMemo(() => guessCategory(text || ' '), [text]);
  const category = catOverride ?? autoCategory;

  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const lines = trimmed.split('\n').map((l) => l.replace(/^[-*•\s]+/, '').trim()).filter(Boolean);
    const title = (lines[0] ?? 'Untitled').slice(0, 90);
    const rest = lines.slice(1);

    const brain = useBrainStore.getState();
    const items = fmt === 'todo' ? (rest.length ? rest : [title]).map((t) => ({ text: t, done: false })) : undefined;
    const remindAt = fmt === 'reminder' ? `${remindDate} ${remindTime}` : undefined;
    const body = fmt === 'todo' ? '' : rest.join('\n') || (fmt === 'note' ? '' : title);

    // Every note becomes a brain node — the shelf and the graph stay one system.
    const content =
      fmt === 'todo'
        ? `# ${title}\n\n${items!.map((i) => `- [ ] ${i.text}`).join('\n')}`
        : fmt === 'commitment'
          ? `# ${title}\n\n> ${body}\n\n**Sworn:** ${format(new Date(), 'd MMM yyyy')} #commitment`
          : fmt === 'reminder'
            ? `# ${title}\n\n${body}\n\n**When:** ${remindAt}`
            : `# ${title}\n\n${trimmed === title ? '' : trimmed}`;
    const node = brain.addNode({ title, content, category, type: fmt === 'todo' ? 'task' : 'note', tags: [category, fmt] });
    for (const hit of suggestLinks(brain.nodes, trimmed, node.id, 2)) brain.addManualLink(node.id, hit.id);

    useNotesStore.getState().addNote({ title, body, format: fmt, category, items, remindAt, nodeId: node.id });

    if (fmt === 'reminder') {
      useOpsStore.getState().addTask({ title, priority: 'high', category, due: remindDate, linkedNodeId: node.id });
      useOpsStore.getState().pushFeed({ kind: 'reminder', title: 'Reminder armed', body: `${title} — ${remindAt}`, priority: 1 });
    }

    // Launch the flight: capture box → brain sigil in the header.
    const from = deckRef.current?.getBoundingClientRect();
    const to = document.getElementById('brain-sigil')?.getBoundingClientRect();
    if (from && to) {
      setFlight({
        title,
        category,
        from: { x: from.left + from.width * 0.5, y: from.top + 40 },
        to: { x: to.left + to.width / 2, y: to.top + to.height / 2 },
      });
    } else {
      useUIStore.getState().toast('Committed to brain', 'success');
    }
    setText('');
    setCatOverride(null);
  };

  return (
    <div
      ref={deckRef}
      className="relative rounded-2xl border border-holo/15 p-6 pb-5"
      style={{
        background: 'linear-gradient(180deg, rgba(230,195,124,0.045), rgba(255,246,228,0.015))',
        boxShadow: '0 24px 60px -40px rgba(0,0,0,0.9)',
      }}
    >
      {/* Corner brackets */}
      {(['top-2 left-2 border-t border-l', 'top-2 right-2 border-t border-r', 'bottom-2 left-2 border-b border-l', 'bottom-2 right-2 border-b border-r'] as const).map(
        (pos) => (
          <span key={pos} className={cn('pointer-events-none absolute h-3.5 w-3.5 border-holo/30', pos)} />
        )
      )}

      <p className="font-mono text-[9.5px] uppercase tracking-[0.3em] text-holo/85">
        Capture · it leaves your head, it enters the system
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
        placeholder="Write it down. First line becomes the title…"
        rows={Math.min(6, Math.max(2, text.split('\n').length))}
        className="mt-3 w-full resize-none !border-0 !bg-transparent !p-0 font-display text-2xl leading-relaxed text-ice placeholder:text-faint focus:!outline-none"
        aria-label="Capture note"
      />

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-[9px] tracking-[0.2em] text-faint">AS</span>
        {FORMATS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFmt(f.id)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[11.5px] transition-all duration-200',
              fmt === f.id
                ? 'border-holo/40 bg-holo/10 text-holo'
                : 'border-white/10 text-steel hover:border-white/20 hover:text-ice'
            )}
          >
            {f.label}
          </button>
        ))}

        {fmt === 'reminder' && (
          <span className="flex items-center gap-1.5">
            <input type="date" value={remindDate} onChange={(e) => setRemindDate(e.target.value)} className="!py-1 !px-2 font-mono text-[11px]" aria-label="Reminder date" />
            <input type="time" value={remindTime} onChange={(e) => setRemindTime(e.target.value)} className="!py-1 !px-2 font-mono text-[11px]" aria-label="Reminder time" />
          </span>
        )}

        <span className="mx-1 h-4 w-px bg-white/10" />
        <span className="font-mono text-[9px] tracking-[0.2em] text-faint">INTO</span>
        {CATEGORY_ORDER.slice(0, 5).map((c) => {
          const active = category === c;
          const isAuto = active && !catOverride;
          return (
            <button
              key={c}
              onClick={() => setCatOverride(catOverride === c ? null : c)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] transition-all duration-200',
                active ? 'border-holo/40 bg-holo/10 text-ice' : 'border-white/10 text-steel hover:text-ice'
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_META[c].color }} />
              {CATEGORY_META[c].label}
              {isAuto && <span className="font-mono text-[8px] tracking-widest text-holo/70">AUTO</span>}
            </button>
          );
        })}

        <button
          onClick={commit}
          disabled={!text.trim()}
          className="btn-holo w-full justify-center !px-5 !py-2.5 !text-[12px] !tracking-[0.1em] disabled:opacity-35 md:ml-auto md:w-auto"
        >
          <ArrowUp className="h-3.5 w-3.5" /> COMMIT TO BRAIN
        </button>
      </div>

      {/* Flying note */}
      <AnimatePresence>
        {flight && (
          <motion.div
            key="flight"
            className="pointer-events-none fixed z-50 w-48 rounded-lg border px-3 py-2"
            style={{
              left: 0,
              top: 0,
              borderColor: CATEGORY_META[flight.category].color + '77',
              background: 'rgba(19,17,9,0.94)',
              boxShadow: `0 0 30px -8px ${CATEGORY_META[flight.category].color}`,
            }}
            initial={{ x: flight.from.x - 96, y: flight.from.y, scale: 1, opacity: 1, rotate: 0 }}
            animate={{
              x: [flight.from.x - 96, (flight.from.x + flight.to.x) / 2 - 96, flight.to.x - 96],
              y: [flight.from.y, Math.min(flight.from.y, flight.to.y) - 70, flight.to.y - 14],
              scale: [1, 0.7, 0.08],
              opacity: [1, 1, 0.4],
              rotate: [-2, -7, -12],
            }}
            transition={{ duration: 0.85, ease: [0.3, 0, 0.25, 1], times: [0, 0.55, 1] }}
            onAnimationComplete={() => {
              setFlight(null);
              window.dispatchEvent(new Event('jarvis:brain-pulse'));
              useUIStore.getState().toast(`“${flight.title}” committed to brain`, 'success');
            }}
          >
            <p className="truncate font-display text-xs text-ice">{flight.title}</p>
            <p className="font-mono text-[9px] text-steel">routing → {CATEGORY_META[flight.category].label}…</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The shelf                                                           */
/* ------------------------------------------------------------------ */

const Shelf = memo(function Shelf() {
  const notes = useNotesStore((s) => s.notes);

  const groups = useMemo(() => {
    const by = new Map<Category, BrainNote[]>();
    for (const n of notes) {
      if (!by.has(n.category)) by.set(n.category, []);
      by.get(n.category)!.push(n);
    }
    return CATEGORY_ORDER.filter((c) => by.has(c)).map((c) => ({ category: c, notes: by.get(c)! }));
  }, [notes]);

  return (
    <>
      <div className="mb-4 mt-9 flex items-baseline gap-4 px-0.5">
        <h2 className="font-display text-[15px] tracking-[0.24em] text-ice">THE SHELF</h2>
        <span className="font-mono text-[10px] tracking-[0.18em] text-faint">
          {notes.length} NOTES · {groups.length} SUBJECTS
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-holo/20 to-transparent" />
      </div>

      {groups.length === 0 ? (
        <p className="py-16 text-center text-sm text-steel">The shelf is empty. Write something above — it takes four seconds.</p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
          {groups.map((g) => (
            <div key={g.category}>
              <div className="flex items-center gap-2.5 px-0.5 pb-2.5">
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: CATEGORY_META[g.category].color }} />
                <h3 className="font-display text-[13px] tracking-[0.14em] text-ice">
                  {CATEGORY_META[g.category].label.toUpperCase()}
                </h3>
                <span className="ml-auto font-mono text-[10px] text-faint">{g.notes.length}</span>
              </div>
              <div className="flex flex-col gap-3">
                <AnimatePresence initial={false}>
                  {g.notes.map((n) => (
                    <NoteCard key={n.id} note={n} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
});

const NoteCard = memo(function NoteCard({ note }: { note: BrainNote }) {
  const toggleItem = useNotesStore((s) => s.toggleItem);
  const deleteNote = useNotesStore((s) => s.deleteNote);
  const select = useBrainStore((s) => s.select);
  const setView = useUIStore((s) => s.setView);

  const openNode = note.nodeId
    ? () => {
        select(note.nodeId!);
        setView('godseye');
      }
    : undefined;

  const doneCount = note.items?.filter((i) => i.done).length ?? 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      className={cn(
        'group relative rounded-[13px] border p-4 transition-colors duration-300',
        note.format === 'commitment'
          ? 'border-holo/30 bg-gradient-to-b from-holo/[0.06] to-white/[0.015]'
          : 'border-white/[0.07] bg-white/[0.028] hover:border-holo/25',
        note.format === 'reminder' && 'pl-[18px]'
      )}
      style={{ boxShadow: '0 14px 34px -26px rgba(0,0,0,0.85)' }}
    >
      {note.format === 'reminder' && (
        <span
          className="absolute bottom-3 left-0 top-3 w-[2px] rounded"
          style={{ background: 'linear-gradient(180deg,#E2A85C,transparent)' }}
        />
      )}
      {note.format === 'commitment' && (
        <span
          className="absolute right-3 top-3 grid h-[22px] w-[22px] place-items-center rounded-full"
          style={{
            background: 'radial-gradient(circle at 35% 30%, #F5DFAC, #E6C37C 55%, #7a6133)',
            boxShadow: '0 0 14px -3px var(--holo-dim)',
          }}
        >
          <span className="h-2.5 w-2.5 rounded-full border border-void/50" />
        </span>
      )}

      {/* Kind row */}
      <div
        className={cn(
          'mb-2 flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.26em]',
          note.format === 'todo' && 'text-[#7FD8E5]',
          note.format === 'reminder' && 'text-[#E2A85C]',
          note.format === 'commitment' && 'text-holo',
          note.format === 'note' && 'text-steel'
        )}
      >
        {note.format === 'todo' && <ClipboardCheck className="h-3 w-3" />}
        {note.format === 'reminder' && <Bell className="h-3 w-3" />}
        {note.format === 'note' && <FileText className="h-3 w-3" />}
        {note.format === 'todo'
          ? `TO-DO · ${doneCount} OF ${note.items?.length ?? 0}`
          : note.format.toUpperCase()}
      </div>

      {note.format !== 'commitment' && <h4 className="mb-1.5 text-[13.5px] font-semibold text-ice">{note.title}</h4>}

      {note.format === 'commitment' ? (
        <>
          <p className="pr-6 font-display text-sm italic leading-relaxed text-ice">“{note.body}”</p>
          <p className="mt-2.5 font-mono text-[9px] tracking-[0.22em] text-holo">
            SWORN · {format(parseISO(note.createdAt), 'dd MMM yy').toUpperCase()}
          </p>
        </>
      ) : note.format === 'todo' ? (
        <>
          {note.items?.map((item, i) => (
            <button
              key={i}
              onClick={() => toggleItem(note.id, i)}
              className={cn(
                'flex w-full items-center gap-2.5 py-1 text-left text-[12.3px] transition-colors',
                item.done ? 'text-faint line-through' : 'text-ice hover:text-holo'
              )}
            >
              <span
                className={cn(
                  'grid h-3.5 w-3.5 shrink-0 place-items-center rounded border transition-all',
                  item.done ? 'border-holo/40 bg-holo/10' : 'border-white/20'
                )}
              >
                {item.done && <Check className="h-2.5 w-2.5 text-holo" />}
              </span>
              {item.text}
            </button>
          ))}
          <div className="mt-2.5 h-[2px] overflow-hidden rounded bg-white/[0.06]">
            <motion.div
              className="h-full"
              style={{ background: 'linear-gradient(90deg, var(--holo), #F5DFAC)' }}
              animate={{ width: `${note.items?.length ? (doneCount / note.items.length) * 100 : 0}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </>
      ) : (
        note.body && <p className="text-xs leading-relaxed text-steel">{note.body}</p>
      )}

      {note.format === 'reminder' && note.remindAt && (
        <span
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px]"
          style={{ color: '#E2A85C', borderColor: 'rgba(226,168,92,0.3)', background: 'rgba(226,168,92,0.07)' }}
        >
          <Bell className="h-2.5 w-2.5" />
          {format(parseISO(note.remindAt.replace(' ', 'T')), 'EEE · HH:mm').toUpperCase()}
        </span>
      )}

      {/* Footer actions */}
      <div className="mt-2.5 flex items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {openNode && (
          <button onClick={openNode} className="font-mono text-[9.5px] text-holo/80 hover:text-holo hover:underline">
            ◉ IN GOD'S EYE
          </button>
        )}
        <button
          aria-label="Delete note"
          onClick={() => deleteNote(note.id)}
          className="ml-auto text-steel/50 hover:text-alert"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
});
