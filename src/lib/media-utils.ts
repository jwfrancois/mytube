/**
 * Shared media utility functions.
 * Single source of truth for type-checking helpers used across the app.
 */

export function isAudioType(type: string): boolean {
  return ['MUSIC', 'PODCAST', 'AUDIOBOOK', 'RADIO'].includes(type)
}
