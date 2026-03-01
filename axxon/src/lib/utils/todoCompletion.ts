export function isTodoEffectivelyComplete(todoIsComplete?: boolean, categoryIsDone?: boolean) {
  return Boolean(todoIsComplete && categoryIsDone);
}
