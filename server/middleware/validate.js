/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/middleware/validate.js]
 *
 * WHO I AM:    Request body validation middleware.
 * WHAT I OWN:  Validating that required fields exist in request bodies and
 *              that field values conform to declared types (string, object,
 *              array, number).
 * WHAT I DON'T: Rich business rule validation (e.g. database existence checks).
 * WHO CALLS ME: Routes that accept POST/PUT payloads (e.g., server/routes/proxy.js).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * TYPE_CHECKERS — maps type-rule names to their validation predicates.
 *
 * WHY we use explicit typeof/Array.isArray checks:
 *   typeof null === 'object' in JS, so naive typeof checks would incorrectly
 *   accept null as a valid object. These predicates handle that edge case.
 *
 * @type {Record<string, (value: *) => boolean>}
 */
const TYPE_CHECKERS = {
  string:  (v) => typeof v === 'string',
  number:  (v) => typeof v === 'number' && !isNaN(v),
  object:  (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  array:   (v) => Array.isArray(v),
  boolean: (v) => typeof v === 'boolean'
};

/**
 * validate — generates validation middleware for a given schema configuration.
 *
 * WHY validation runs before controller logic:
 *   Ensures requests without required parameters fail early, preventing
 *   runtime crashes or database errors in downstream code.
 *
 * Schema format: `{ fieldName: 'required|string', otherField: 'optional|object' }`
 * - First segment is `required` or `optional` (presence rule)
 * - Second segment is a type name from TYPE_CHECKERS (type rule)
 *
 * @param {Record<string, string>} schema - Pipe-delimited field rules,
 *   e.g. `{ url: 'required|string', headers: 'optional|object' }`
 * @returns {import('express').RequestHandler} Express middleware
 */
export function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const [key, rule] of Object.entries(schema)) {
      // WHY we split on '|':
      // Rules are pipe-delimited strings like 'required|string'. Splitting
      // lets us inspect presence and type constraints independently.
      const parts = rule.split('|');
      const isRequired = parts.includes('required');
      const val = req.body?.[key];

      // --- Presence check ---
      if (isRequired && (val === undefined || val === null || val === '')) {
        errors.push({ field: key, message: `Field '${key}' is required.` });
        // WHY we continue instead of break:
        // Collecting all errors at once lets the client fix everything in one round-trip.
        continue;
      }

      // --- Type check (only when value is present) ---
      if (val !== undefined && val !== null) {
        // Find the declared type rule (anything that isn't 'required' or 'optional')
        const typeName = parts.find(p => p !== 'required' && p !== 'optional');

        if (typeName && TYPE_CHECKERS[typeName]) {
          if (!TYPE_CHECKERS[typeName](val)) {
            errors.push({
              field: key,
              message: `Field '${key}' must be of type '${typeName}', got '${Array.isArray(val) ? 'array' : typeof val}'.`
            });
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid request payload.',
          details: errors
        }
      });
    }

    next();
  };
}
