// Main Lambda handler
import { route } from './router.js';
import { errorResponse } from './utils.js';

export async function handler(event) {
  try {
    console.log('Event:', JSON.stringify(event, null, 2));
    return await route(event);
  } catch (error) {
    console.error('Error:', error);
    return errorResponse(500, 'INTERNAL_ERROR', error.message || 'Internal server error');
  }
}
