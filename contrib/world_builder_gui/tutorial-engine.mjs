export function advanceTutorialAction(action, eventType, targetMatches, currentCount = 0) {
  if (!action || !targetMatches) return { matched:false, count:currentCount, complete:false };
  const acceptedEvents = action.event === "change" ? ["input","change"] : [action.event];
  if (!acceptedEvents.includes(eventType)) return { matched:false, count:currentCount, complete:false };
  const count = currentCount + 1;
  return { matched:true, count, complete:count >= Math.max(1,Number(action.count || 1)) };
}

export function shouldBlockTutorialInteraction({ active, trusted, withinControls, targetMatches }) {
  if (!active || !trusted || withinControls) return false;
  return !targetMatches;
}
