export function lowerBound(rows, value, key = "time_s") {
  let low = 0;
  let high = rows.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (rows[middle][key] < value) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function upperBound(rows, value, key = "time_s") {
  let low = 0;
  let high = rows.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (rows[middle][key] <= value) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function visibleSlice(rows, minimum, maximum, key = "time_s") {
  if (!rows.length) return [];
  const start = Math.max(0, lowerBound(rows, minimum, key) - 1);
  const end = Math.min(rows.length, upperBound(rows, maximum, key) + 1);
  return rows.slice(start, end);
}

export function minMaxDownsample(rows, seriesKeys, maxPoints = 4_000) {
  if (rows.length <= maxPoints || maxPoints < 4) return rows;
  const keys = seriesKeys.length ? seriesKeys : ["time_s"];
  const pointsPerBucket = Math.max(1, keys.length * 2);
  const bucketCount = Math.max(1, Math.floor((maxPoints - 2) / pointsPerBucket));
  const bucketSize = Math.ceil(rows.length / bucketCount);
  const selected = new Set([0, rows.length - 1]);

  for (let start = 0; start < rows.length; start += bucketSize) {
    const end = Math.min(rows.length, start + bucketSize);
    for (const key of keys) {
      let minIndex = -1;
      let maxIndex = -1;
      let minimum = Number.POSITIVE_INFINITY;
      let maximum = Number.NEGATIVE_INFINITY;
      for (let index = start; index < end; index += 1) {
        const value = rows[index][key];
        if (!Number.isFinite(value)) continue;
        if (value < minimum) {
          minimum = value;
          minIndex = index;
        }
        if (value > maximum) {
          maximum = value;
          maxIndex = index;
        }
      }
      if (minIndex >= 0) selected.add(minIndex);
      if (maxIndex >= 0) selected.add(maxIndex);
    }
  }
  return [...selected].sort((left, right) => left - right).map((index) => rows[index]);
}

