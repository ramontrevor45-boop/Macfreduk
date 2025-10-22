export default async function handler(req, res) {
  const { value } = req.query;

  if (!value) {
    return res.status(400).json({ ok: false, msg: "Falta el parámetro 'value'" });
  }

  // Función para validar con el algoritmo de Luhn
  function validateLuhn(number) {
    let sum = 0;
    let shouldDouble = false;

    for (let i = number.length - 1; i >= 0; i--) {
      let digit = parseInt(number.charAt(i));
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
  }

  // Si el valor no es un número de tarjeta o BIN válido
  if (!/^\d{6,19}$/.test(value)) {
    return res.status(200).json({ ok: false, resultado: "❌ Ingresa un número válido (6-19 dígitos)." });
  }

  // Validar con Luhn
  const luhnValido = validateLuhn(value);

  // Consultar el BIN en la API pública Binlist
  const bin = value.substring(0, 8);
  let binInfo = {};
  try {
    const response = await fetch(`https://lookup.binlist.net/${bin}`, {
      headers: { "Accept": "application/json" },
    });
    if (response.ok) {
      binInfo = await response.json();
    }
  } catch (err) {
    console.error("Error al consultar Binlist:", err);
  }

  // Construir respuesta con la información encontrada
  const info = [];
  if (binInfo.scheme) info.push(`💳 ${binInfo.scheme.toUpperCase()}`);
  if (binInfo.type) info.push(`(${binInfo.type})`);
  if (binInfo.bank && binInfo.bank.name) info.push(`🏦 ${binInfo.bank.name}`);
  if (binInfo.country && binInfo.country.name) info.push(`🌍 ${binInfo.country.name}`);

  let resultado = "";
  if (luhnValido) {
    resultado = "✅ Tarjeta válida según Luhn";
    if (info.length > 0) resultado += `\n${info.join(" — ")}`;
  } else {
    resultado = "⚠️ El número no pasa la verificación de Luhn.";
    if (info.length > 0) resultado += `\nPosible BIN detectado: ${info.join(" — ")}`;
  }

  res.status(200).json({
    ok: true,
    input: value,
    resultado,
  });
}
