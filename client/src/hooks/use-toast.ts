// Minimal toast hook — shadcn/ui style.
import * as React from "react";
import type { ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 5000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
};

type State = { toasts: ToasterToast[] };

const listeners: Array<(s: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(next: State) {
  memoryState = next;
  listeners.forEach((l) => l(memoryState));
}

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

const timeouts = new Map<string, ReturnType<typeof setTimeout>>();
function scheduleRemoval(id: string) {
  if (timeouts.has(id)) return;
  const t = setTimeout(() => {
    timeouts.delete(id);
    dispatch({ toasts: memoryState.toasts.filter((t) => t.id !== id) });
  }, TOAST_REMOVE_DELAY);
  timeouts.set(id, t);
}

type Toast = Omit<ToasterToast, "id">;

function toast(props: Toast) {
  const id = genId();
  const next: ToasterToast = { ...props, id, open: true };
  dispatch({ toasts: [next, ...memoryState.toasts].slice(0, TOAST_LIMIT) });
  scheduleRemoval(id);
  return {
    id,
    dismiss: () => dispatch({ toasts: memoryState.toasts.filter((t) => t.id !== id) }),
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const i = listeners.indexOf(setState);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);
  return {
    ...state,
    toast,
    dismiss: (id?: string) =>
      dispatch({
        toasts: id ? memoryState.toasts.filter((t) => t.id !== id) : [],
      }),
  };
}

export { useToast, toast };
