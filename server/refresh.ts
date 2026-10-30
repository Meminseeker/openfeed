// Serialize accounts and skip overlapping timer ticks; one account's failure must
// not prevent the remaining accounts from refreshing.
export function hourlyRefresh(
  users: () => string[],
  refresh: (id: string) => Promise<void>,
  report: (error: unknown) => void,
) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      for (const id of users()) {
        try {
          await refresh(id);
        } catch (error) {
          report(error);
        }
      }
    } catch (error) {
      report(error);
    } finally {
      running = false;
    }
  };
}
