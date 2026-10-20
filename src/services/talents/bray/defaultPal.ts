// Bray fork: the "Bray" Pal is the default for every new chat, so Bo never has
// to pick a persona. He can still switch Pals by hand; that choice lasts for the
// chat he is in. If the Bray Pal has been deleted, upstream behaviour applies.
import {BRAY_PAL_NAME} from './seedBrayPal';

interface PalLike {
  id: string;
  name: string;
  source?: string;
}

/** Id of the local "Bray" Pal, or undefined if there is none. */
export function brayPalId(pals: PalLike[] | undefined): string | undefined {
  return (pals ?? []).find(
    p => p.name === BRAY_PAL_NAME && p.source === 'local',
  )?.id;
}

/**
 * Pal for a fresh new chat: Bray when it exists, otherwise `fallback`
 * (upstream carries the current chat's Pal over).
 */
export function newChatDefaultPalId(
  pals: PalLike[] | undefined,
  fallback: string | undefined,
): string | undefined {
  return brayPalId(pals) ?? fallback;
}
