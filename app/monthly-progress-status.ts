/** Use unrounded percentages for boundaries; displayed whole percentages never
 * suggest a milestone has been reached before it actually has. */
export function monthlyProgressStatus(percent: number | null) {
  if (percent === null) return { label: 'Set a plan', display: '—' };
  const display = `${Math.floor(Math.max(0, percent))}%`;
  if (percent >= 181) return { label: 'Outrageous!', display };
  if (percent >= 131) return { label: 'Excellent!', display };
  if (percent >= 100) return { label: 'Perfect!', display };
  if (percent >= 80) return { label: 'Good', display };
  if (percent >= 50) return { label: 'Over halfway!', display };
  if (percent > 0) return { label: 'Making progress', display };
  return { label: 'Your month starts here', display };
}
