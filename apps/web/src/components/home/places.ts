/** Aéroports internationaux tunisiens (code IATA) proposés comme lieux de prise en charge. */
export const AIRPORTS = [
  { id: 'tunisCarthage', code: 'TUN' },
  { id: 'enfidha', code: 'NBE' },
  { id: 'monastir', code: 'MIR' },
  { id: 'djerba', code: 'DJE' },
  { id: 'sfaxAirport', code: 'SFA' },
  { id: 'tozeur', code: 'TOE' },
  { id: 'tabarka', code: 'TBJ' },
  { id: 'gafsa', code: 'GAF' },
] as const;

export const CITIES = ['tunis', 'sousse', 'hammamet', 'sfax', 'bizerte'] as const;
