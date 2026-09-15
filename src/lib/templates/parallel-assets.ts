/** Bound COS traffic and image decoding; drain the current batch before propagating failure. */
export async function mapAssetBatches<T, R>(items: readonly T[], work: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = [];
  for (let offset = 0; offset < items.length; offset += 3) {
    const results = await Promise.allSettled(items.slice(offset, offset + 3).map(async (item) => work(item)));
    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
      output.push(result.value);
    }
  }
  return output;
}
