/** In-memory AsyncStorage for these tests (the repo-wide mock resolves to undefined). */
const data = new Map<string, string>();

const memoryAsyncStorage = {
  getItem: async (k: string) => (data.has(k) ? data.get(k)! : null),
  setItem: async (k: string, v: string) => {
    data.set(k, v);
  },
  removeItem: async (k: string) => {
    data.delete(k);
  },
  clear: async () => {
    data.clear();
  },
};

export default memoryAsyncStorage;
