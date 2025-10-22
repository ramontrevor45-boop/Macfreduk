export default async function handler(req, res) {
  // Permitir GET y POST (POST recomendado)
  const MAX_ITEMS = 20;

  // Obtener lista de valores: POST JSON { values: [...] } o GET ?values=a,b,c
  let values = [];
  if (req.method === "POST") {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", chunk => (data += chunk));
        req.on("end", () => {
          try { resolve(JSON.parse(data || "{}")); }
          catch(e){ reject(e); }
        });
        req.on("error", reject);
      });
      if (body && Array.isArray(body.values)) values = body.values;
    } catch (err) {
      // si falla parseo, continuar para ver si hay GET
      values = [];
    }
  }
  if (!values || values.length === 0) {
    // intentar con GET ?values=a,b,c
    const q = (req.query && (req.query.values || req.query.value)) || "";
    if (typeof q === "string" && q.trim() !== "") {
      values = q.split(",").map(s => s.trim()).filter(Boolean);
    }
  }

  if (!Array.isArray(values) || values.length === 0) {
    return res.status(400).json({ ok: false, msg: "Envía un array 'values' (POST JSON) o ?values=a,b,c (GET)." });
  }

  if (values.length > MAX_ITEMS) {
    return res.status(400).json({ ok: false, msg: `Máximo ${MAX_ITEMS} valores por petición.` });
  }

  // Limpia y normaliza los números: quitar espacios y guiones
  const normalize = s => String(s).replace(/\s|-/g, "");

  // Luhn
  function validateLuhn(number) {
    const n = String(number);
    let sum = 0;
    let shouldDouble = false;
    for (let i = n.length - 1; i >= 0; i--) {
      let d = parseInt(n.charAt(i), 10);
      if (Number.isNaN(d)) return false;
      if (shouldDouble) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  // Enmascarar (mostrar primeros 6 y últimos 4 si existen, resto con asteriscos)
  function maskNumber(num) {
    const n = String(num);
    if (n.length <= 6) return n.replace(/\d/g, "*");
    const first6 = n.slice(0, 6);
    const last4 = n.length > 10 ? n.slice(-4) : "";
    const middleLen = Math.max(0, n.length - first6.length - last4.length);
    const middle = "*".repeat(middleLen);
    return `${first6}${middle}${last4}`;
  }

  // Consulta Binlist (con manejo de timeout)
  async function fetchBinInfo(bin6) {
    if (!/^\d{6}$/.test(bin6)) return { ok: false, message: "BIN inválido" };
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
      const resp = await fetch(`https://lookup.binlist.net/${bin6}`, {
        headers: { Accept: "application/json", "User-Agent": "Freduk-CheckApp/1.0" },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        if (resp.status === 404) return { ok: false, message: "BIN no encontrado", status: 404 };
        if (resp.status === 429) return { ok: false, message: "Rate limit BINList", status: 429 };
        return { ok: false, message: `Binlist status ${resp.status}`, status: resp.status };
      }
      const data = await resp.json();
      return { ok: true, data };
    } catch (err) {
      if (err.name === "AbortError") return { ok: false, message: "Timeout al consultar BIN" };
      return { ok: false, message: "Error de red al consultar BIN" };
    }
  }

  // Procesar en serie para evitar golpear rate-limit demasiado rápido
  const results = [];
  for (const raw of values) {
    const normalized = normalize(raw);
    // validar formato mínimo: dígitos y longitud entre 12 y 19 (ajustable)
    const isDigits = /^\d{12,19}$/.test(normalized);
    let luhn = false;
    let bin6 = null;
    let binInfo = null;
    let resultado = "";

    if (!isDigits) {
      resultado = "❌ Formato inválido (esperado 12-19 dígitos)";
    } else {
      luhn = validateLuhn(normalized);
      bin6 = normalized.slice(0, 6);
      // Consultar Binlist (solo si tenemos 6+ dígitos)
      const binResp = await fetchBinInfo(bin6);
      if (binResp.ok) {
        binInfo = binResp.data;
      } else {
        // No romper: dejamos binInfo null y aportamos el mensaje
        binInfo = null;
      }

      if (luhn) {
        resultado = "✅ Pasa Luhn";
      } else {
        resultado = "⚠️ No pasa Luhn";
      }

      // Añadir información de BIN si existe
      if (binInfo && binInfo.scheme) {
        const parts = [];
        parts.push(binInfo.scheme ? binInfo.scheme.toUpperCase() : null);
        if (binInfo.type) parts.push(binInfo.type);
        if (binInfo.brand) parts.push(binInfo.brand);
        if (binInfo.bank && binInfo.bank.name) parts.push(binInfo.bank.name);
        if (binInfo.country && binInfo.country.name) parts.push(binInfo.country.name);
        resultado += ` — ${parts.filter(Boolean).join(" — ")}`;
      } else {
        // si no hay info de BIN, opcionalmente mostrar nota
        // (pero mantenemos privacidad; no mostramos número completo)
      }
    }

    results.push({
      masked: maskNumber(normalized),
      rawLength: String(normalized).length,
      luhn,
      bin: bin6,
      binInfo: binInfo || null,
      resultado
    });

    // pequeña pausa para ser amable con Binlist (50-150ms). Ajustable.
    await new Promise(r => setTimeout(r, 80));
  }

  // Responder
  return res.status(200).json({
    ok: true,
    count: results.length,
    results,
    note: "Usa solo números legítimos o tarjetas de prueba. No abuses del servicio."
  });
}
