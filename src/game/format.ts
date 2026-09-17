export function formatMoney(value: number): string {
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} $`;
}

export function formatMoneyPrecise(value: number): string {
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $`;
}

export function formatUnits(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
}
