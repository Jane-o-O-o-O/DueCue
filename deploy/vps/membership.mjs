export const DAY_MS = 86_400_000;
export const TRIAL_DAYS = 30;
export const TRIAL_MS = TRIAL_DAYS * DAY_MS;

/** @param {{ started: number, paid_until: number, permanent: number } | null} record */
export function membershipStatus(record, now = Date.now()) {
  const permanent = record?.permanent === 1;
  const end = record && !permanent ? Math.max(record.started + TRIAL_MS, record.paid_until) : 0;
  return {
    started: record?.started ?? 0,
    end,
    active: permanent || !record || end > now,
    paid: permanent || (record?.paid_until ?? 0) > now,
    permanent,
  };
}
