/**
 * Global vitest setup. Runs once per worker before any test executes.
 *
 * IS_REACT_ACT_ENVIRONMENT is the React 18 opt-in that lets `act(...)`
 * flush passive effects synchronously inside tests. Setting it here keeps
 * the flag out of every individual test file. The flag is only consulted
 * by react-dom in test environments — it has no effect at runtime.
 */

declare global {
  interface GlobalThis {
    IS_REACT_ACT_ENVIRONMENT: boolean
  }
}

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

export {}
