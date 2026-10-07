/**
 * En-tête interne posé par le middleware sur chaque requête réécrite : langue résolue
 * depuis l'URL publique. Toujours écrasé par le middleware, il ne peut pas être forgé par le client.
 */
export const LOCALE_HEADER = 'x-drivetn-locale';
