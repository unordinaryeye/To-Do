let counter = 0;

/** 접두사 + 시각 + 순번. 같은 밀리초에 여러 개를 만들어도 겹치지 않는다. */
export function newId(prefix) {
  counter = (counter + 1) % 1000;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36).padStart(2, "0")}`;
}

export function randomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}
