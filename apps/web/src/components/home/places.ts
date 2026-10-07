/**
 * Aéroports internationaux tunisiens (code IATA) proposés comme lieux de prise en charge.
 * `slug` correspond au référentiel des lieux de l'API.
 */
export const AIRPORTS = [
  { id: 'tunisCarthage', code: 'TUN', slug: 'aeroport-tunis-carthage' },
  { id: 'enfidha', code: 'NBE', slug: 'aeroport-enfidha-hammamet' },
  { id: 'monastir', code: 'MIR', slug: 'aeroport-monastir' },
  { id: 'djerba', code: 'DJE', slug: 'aeroport-djerba-zarzis' },
  { id: 'sfaxAirport', code: 'SFA', slug: 'aeroport-sfax-thyna' },
  { id: 'tozeur', code: 'TOE', slug: 'aeroport-tozeur-nefta' },
  { id: 'tabarka', code: 'TBJ', slug: 'aeroport-tabarka-ain-draham' },
  { id: 'gafsa', code: 'GAF', slug: 'aeroport-gafsa-ksar' },
] as const;

/** Villes mises en avant ; l'identifiant est aussi le slug du référentiel. */
export const CITIES = ['tunis', 'sousse', 'hammamet', 'sfax', 'bizerte'] as const;
