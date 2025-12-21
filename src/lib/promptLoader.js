/**
 * Simple prompt loader for YAML templates
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const PROMPTS_DIR = path.join(process.cwd(), 'src', 'prompts');

/**
 * Load a prompt template from YAML
 * @param {string} name - Prompt file name (without .yaml extension)
 * @returns {object} - Parsed prompt template
 */
export function loadPrompt(name) {
  const filePath = path.join(PROMPTS_DIR, `${name}.yaml`);
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(content);
}

/**
 * Fill template variables in a string
 * @param {string} template - Template string with {{variable}} placeholders
 * @param {object} variables - Key-value pairs to replace
 * @returns {string} - Filled template
 */
export function fillTemplate(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  }
  return result;
}

