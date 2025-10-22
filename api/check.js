export default async function handler(req, res) {
  try {
    const { value } = req.query;
    if (!value) return res.status(400).json({ ok: false, msg: "Falta el parámetro 'value'" });

    const soloNumeros = /^[0-9]+$/.test(value);
    const resultado = soloNumeros ? "✅ Valor válido (solo números)" : "❌ Valor inválido";

    return res.status(200).json({
      ok: true,
      input: value,
      resultado
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
