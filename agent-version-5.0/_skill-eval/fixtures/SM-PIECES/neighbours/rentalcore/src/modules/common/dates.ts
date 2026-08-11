// Все даты монолита сериализуются в UTC без миллисекунд.
export const toWire = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
