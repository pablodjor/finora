export function emmitaWelcomeSessionKey(userId) {
  return `finora-emmita-welcome:${userId}`
}

/** Limpia el flag para que el festejo vuelva en el próximo login. */
export function clearEmmitaWelcomeFlags() {
  try {
    const keys = []
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i)
      if (key?.startsWith('finora-emmita-welcome:')) keys.push(key)
    }
    keys.forEach((key) => sessionStorage.removeItem(key))
  } catch {
    /* ignore */
  }
}
