/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/request/requestService.js]
 *
 * WHO I AM:    Request execution coordinator.
 * WHAT I OWN:  Compiling target variables, calling the request formatter, dispatching
 *              the request to the network proxy client, and updating states.
 * WHAT I DON'T: Directly changing DOM elements.
 * WHO CALLS ME: client/features/request/requestView.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import state from '../../core/state.js';
import eventBus from '../../core/eventBus.js';
import { buildRequestObject } from '../../network/requestBuilder.js';
import { sendProxiedRequest } from '../../network/proxyClient.js';
import historyService from '../history/historyService.js';
import environmentService from '../environment/environmentService.js';

const requestService = {
  sendCurrentRequest: async () => {
    const rawRequest = state.get('currentRequest');
    
    // Resolve mustache variables in url, headers, and body
    const resolvedUrl = environmentService.resolveTemplate(rawRequest.url);
    const resolvedRequest = {
      ...rawRequest,
      url: resolvedUrl
    };

    state.setLoading(true);
    eventBus.emit('request:sending');

    try {
      const formattedRequest = buildRequestObject(resolvedRequest);
      const responseData = await sendProxiedRequest(formattedRequest);
      
      state.setResponse(responseData);
      
      // Save sent request to circular history buffer
      await historyService.addEntry(rawRequest);
    } catch (error) {
      console.error('[request-service] Send failed:', error);
      eventBus.emit('response:error', error);
    } finally {
      state.setLoading(false);
    }
  }
};

export default requestService;
