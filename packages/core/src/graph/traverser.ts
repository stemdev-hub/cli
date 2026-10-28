/**
 * Internal active-path tracking shared by core traversals. A rejected entry leaves
 * the path unchanged; leaving an entry allows it on a later independent path.
 * Callers supply stable keys for their identity scope. Pure Block callers must
 * distinguish resolved Block instances, rather than keying only by authored ID.
 * This helper is not exported through the public package entry.
 */
export function createActivePath<T>() {
  const entries: T[] = [];
  const positions = new Map<T, number>();

  return {
    enter(value: T): T[] | undefined {
      const position = positions.get(value);
      if (position !== undefined) {
        return [...entries.slice(position), value];
      }
      positions.set(value, entries.length);
      entries.push(value);
      return undefined;
    },
    leave(): void {
      if (entries.length === 0) {
        throw new Error('Cannot leave an empty active path.');
      }
      const value = entries[entries.length - 1] as T;
      entries.pop();
      positions.delete(value);
    }
  };
}
