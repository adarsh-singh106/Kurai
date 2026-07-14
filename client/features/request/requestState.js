/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/request/requestState.js]
 *
 * WHO I AM:    State selectors and mutators interface for the current Request.
 * WHAT I OWN:  Abstracting read/write operations targeting the request state slice.
 * WHAT I DON'T: Persisting data to disks or storing variable scopes inside memory.
 * WHO CALLS ME: client/features/request/requestView.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import state from '../../core/state.js';

const requestState = {
  getCurrent: () => {
    return state.get('currentRequest');
  },

  updateMethod: (method) => {
    state.setMethod(method);
  },

  updateUrl: (url) => {
    state.setUrl(url);
  }
};

export default requestState;
