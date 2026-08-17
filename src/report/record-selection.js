function baseSelection(model, selection = []) {
  if (Array.isArray(selection)) return model.records.filter((record) => selection.includes(record.stepId));
  if (selection.recordKeys?.length) return model.records.filter((record) => selection.recordKeys.includes(record.recordKey));
  return model.records.filter((record) => selection.stepIds?.includes(record.stepId));
}

function eventAsRecord(record, event) {
  return {
    ...record,
    name: `${record.name} — ${event.label}`,
    status: event.status,
    detail: event.detail,
    metrics: event.metrics,
    charts: event.charts,
    eventId: event.eventId
  };
}

/** One canonical reserve source can render as two official event sub-records. */
export function recordsForReportSection(model, selection = []) {
  const records = baseSelection(model, selection);
  if (!selection?.eventId) return records;
  return records.flatMap((record) => {
    const event = record.events?.find((candidate) => candidate.eventId === selection.eventId);
    // Imported legacy/fixture records may not yet carry segmented events. They
    // remain visible as explicitly unsegmented source evidence rather than
    // disappearing from a report section.
    return event ? [eventAsRecord(record, event)] : [record];
  });
}
