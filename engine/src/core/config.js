/**
 * Trading Engine Configuration - ES Module Wrapper
 * 
 * SINGLE SOURCE OF TRUTH: config.json (this file imports from it)
 * 
 * Both this ES module (for Next.js) and the CommonJS wrapper (for Node.js)
 * import from the same config.json file - NO DUPLICATION.
 */

// Import from JSON - the single source of truth
import config from './config.json' assert { type: 'json' };

export const ENGINE_CONFIG = config;

/**
 * Get a deep copy of the engine configuration
 */
export function getEngineConfig() {
  return JSON.parse(JSON.stringify(ENGINE_CONFIG));
}

export default ENGINE_CONFIG;
