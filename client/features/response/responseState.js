/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/response/responseState.js]
 *
 * WHO I AM:    State selectors and mutations interface for the current Response.
 * WHAT I OWN:  Abstracting read/write operations targeting response state slice.
 * WHAT I DON'T: Network connection clients or local history buffers.
 * WHO CALLS ME: client/features/response/responseView.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import state from '../../core/state.js';

const responseState = {
  getCurrent: () => {
    return state.get('currentResponse');
  }
};

export default responseState;
