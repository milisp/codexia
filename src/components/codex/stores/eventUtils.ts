import type { ServerNotification } from '@/bindings';

type DeltaMethod = 'item/agentMessage/delta';

type DeltaEvent = Extract<ServerNotification, { method: DeltaMethod }>;

export const isDeltaEvent = (event: ServerNotification): event is DeltaEvent => {
  return event.method === 'item/agentMessage/delta';
};

const canCompactDeltaEvents = (previous: DeltaEvent, incoming: DeltaEvent): boolean => {
  if (previous.method !== incoming.method) {
    return false;
  }

  switch (incoming.method) {
    case 'item/agentMessage/delta':
      return (
        previous.params.threadId === incoming.params.threadId &&
        previous.params.turnId === incoming.params.turnId &&
        previous.params.itemId === incoming.params.itemId
      );
    default:
      return true;
  }
};

export const compactDeltaEvents = (
  events: ServerNotification[],
  incoming: ServerNotification
): ServerNotification[] => {
  const previous = events[events.length - 1];
  if (!previous || !isDeltaEvent(previous) || !isDeltaEvent(incoming)) {
    return [...events, incoming];
  }

  if (!canCompactDeltaEvents(previous, incoming)) {
    return [...events, incoming];
  }

  const compacted = {
    ...incoming,
    params: {
      ...incoming.params,
      delta: `${previous.params.delta}${incoming.params.delta}`,
    },
  } as ServerNotification;

  return [...events.slice(0, -1), compacted];
};
