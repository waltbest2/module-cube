export function genRandomString(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  } else if (globalThis.crypto?.getRandomValues) {
    const length = 12;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result: string = '';
    const values = new Uint8Array(length);
    globalThis.crypto.getRandomValues(values);

    for(let i = 0; i < length; i++) {
      result += charset[values[i] % charset.length];
    }

    return result;
  } else {
    return `${Date.now()}`;
  }
}