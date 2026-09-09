/**
 * 아주 작은 불변 store. reducer가 같은 참조를 돌려주면 구독자를 부르지 않는다.
 * 구독자는 (state, prevState, action)을 받는다.
 */
export function createStore(reducer, initialState) {
  let state = initialState;
  const listeners = new Set();
  let dispatching = false;
  const queue = [];

  function dispatch(action) {
    queue.push(action);
    if (dispatching) return;
    dispatching = true;
    try {
      while (queue.length) {
        const next = queue.shift();
        const prev = state;
        const updated = reducer(prev, next);
        if (updated === prev) continue;
        state = updated;
        listeners.forEach((listener) => listener(state, prev, next));
      }
    } finally {
      dispatching = false;
    }
  }

  return {
    getState: () => state,
    dispatch,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
