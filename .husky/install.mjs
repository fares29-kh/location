// Husky n'est pas installé dans les images Docker ni en CI : on ignore silencieusement.
if (process.env.CI === 'true' || process.env.HUSKY === '0') {
  process.exit(0);
}

try {
  const { default: husky } = await import('husky');
  husky();
} catch {
  process.exit(0);
}
