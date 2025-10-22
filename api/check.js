export default async function handler(req, res) {
  const { value } = req.query;

  if (!value) {
    return res.status(400).json({ ok: false, msg: "Falta el parámetro 'value'" });
  }

  // Luhn
  function validateLuhn(number) {
    let sum = 0;
    let shouldDouble = false;

    for (let i = number.length - 1; i >= 0; i--) {
      let digit = parseInt(number.charAt(i), 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  // Solo dígitos
  if (!/^\d{6,19}$/.test(value)) {
    return res.status(200).json({ ok: false, input: value, resultado: "❌ Ingresa un número válido (6-19 dígitos)." });
  }

  const luhnValido = validateLuhn(value);

  // Usar los primeros 6 dígitos para BIN/IIN (estándar)
  const bin = value.substring(0, 6);
  let binInfo = null;
  let binMsg = null;

  try {
    const response = await fetch(`https://lookup.binlist.net/${bin}`, {
      headers: { "Accept": "application/json" },
      // no mode/cors aquí porque esto corre en server (Vercel)
    });

    if (response.ok) {
      binInfo = await response.json();
    } else {
      // manejar códigos HTTP (404, 429, etc.)
      if (response.status === 404) binMsg = "ℹ️ BIN no encontrado en la base pública.";
      else if (response.status === 429) binMsg = "ℹ️ Límite de consultas a BINList alcanzado (rate limit).";
      else binMsg = `ℹ️ Binlist respondió con status ${response.status}.`;
    }
  } catch (err) {
    binMsg = "⚠️ Error al consultar Binlist (posible problema de red).";
    console.error("Binlist fetch error:", err);
  }

  // Construir información legible del BIN (si hay)
  const infoParts = [];
  if (binInfo) {
    if (binInfo.scheme) infoParts.push(`💳 ${String(binInfo.scheme).toUpperCase()}`);
    if (binInfo.type) infoParts.push(`(${binInfo.type})`);
    if (binInfo.brand) infoParts.push(`${binInfo.brand}`);
    if (binInfo.bank && binInfo.bank.name) infoParts.push(`🏦 ${binInfo.bank.name}`);
    if (binInfo.country && binInfo.country.name) infoParts.push(`🌍 ${binInfo.country.name}`);
  }

  let resultado = "";
  if (luhnValido) {
    resultado = "✅ Tarjeta válida según Luhn";
  } else {
    resultado = "⚠️ El número no pasa la verificación de Luhn.";
  }

  if (infoParts.length > 0) {
    resultado += `\n${infoParts.join(" — ")}`;
  } else if (binMsg) {
    resultado += `\n${binMsg}`;
  } else {
    resultado += `\nℹ️ No se encontró información adicional del BIN.`;
  }

  return res.status(200).json({
    ok: true,
    input: value,
    luhn: luhnValido,
    bin: bin,
    binInfo: binInfo || null,
    resultado,
  });
}
