import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type NativeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'defaultValue'
>;

interface Props extends NativeInputProps {
  value: string;
  onCommit: (value: string) => void;
  commitDelay?: number;
}

/**
 * An input that decouples typing from the parent/store.
 *
 * - Typing updates only local state (0 parent re-renders).
 * - After `commitDelay` ms of inactivity (or on blur), `onCommit(value)` fires.
 * - If the external `value` prop changes (e.g. undo/redo, restore), local state
 *   re-syncs automatically.
 *
 * This is the recommended input for fields backed by a global store when the
 * containing view is heavy to re-render on every keystroke.
 */
export function DeferredInput({
  value,
  onCommit,
  commitDelay = 200,
  onBlur,
  className,
  ...rest
}: Props) {
  const [local, setLocal] = useState(value);
  // Track the most recently seen external value so we can detect prop-driven
  // changes (undo/redo/restore) during render and resync local state.
  const [prevExternal, setPrevExternal] = useState(value);
  if (value !== prevExternal) {
    setPrevExternal(value);
    setLocal(value);
  }

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null);
  const commitRef = useRef(onCommit);

  // Keep the latest onCommit so the debounced timer always invokes the
  // current callback.
  useEffect(() => {
    commitRef.current = onCommit;
  });

  // External authoritative update — cancel any in-flight edit so it can't
  // later clobber the new value (e.g. undo racing the debounce timer).
  useEffect(() => {
    pendingRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [prevExternal]);

  // Flush any pending edit when the input unmounts so typing is never lost.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const pending = pendingRef.current;
      if (pending !== null) {
        pendingRef.current = null;
        commitRef.current(pending);
      }
    };
  }, []);

  function commit(next: string) {
    pendingRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    commitRef.current(next);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setLocal(next);
    pendingRef.current = next;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commit(next), commitDelay);
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (pendingRef.current !== null) {
      commit(pendingRef.current);
    }
    onBlur?.(e);
  }

  return (
    <input
      {...rest}
      className={cn(className)}
      value={local}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
