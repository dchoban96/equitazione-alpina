// "Parte da tenere in vista" of a cropped photo: the value is a CSS
// object-position ("x% y%"), saved as the block's `focus` field. No value
// means the centre. Keep in step with the select in public/admin/config.yml.
export const FOCUS: [value: string, label: string][] = [
  ['0% 50%', 'Tutto a sinistra'],
  ['25% 50%', 'Sinistra'],
  ['75% 50%', 'Destra'],
  ['100% 50%', 'Tutto a destra'],
  ['50% 0%', 'In alto'],
  ['50% 25%', 'Verso l\'alto'],
  ['50% 75%', 'Verso il basso'],
  ['50% 100%', 'In basso'],
];

export const focusLabel = (v: string): string => FOCUS.find(([value]) => value === v)?.[1] ?? v;
