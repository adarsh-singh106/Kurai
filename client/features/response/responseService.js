/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/response/responseService.js]
 *
 * WHO I AM:    Business logic parser for HTTP Responses.
 * WHAT I OWN:  Parsing response content-types, measuring byte size, executing test assertions,
 *              and formatting timing metrics.
 * WHAT I DON'T: Directly updating DOM elements (responseView.js concerns).
 * WHO CALLS ME: client/features/request/requestService.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const responseService = {
  parsePayload: (rawPayload) => {
    // Basic formatting of status and body
    const bodyParsed = null;
    try {
      if (rawPayload.headers?.['content-type']?.includes('application/json')) {
        bodyParsed = JSON.parse(rawPayload.body);
      }
    } catch (e) {
      // Body not standard json
    }

    return {
      ...rawPayload,
      bodyParsed,
      testResults: []
    };
  }
};

export default responseService;
