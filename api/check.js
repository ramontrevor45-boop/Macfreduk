export default function handler(req, res) {
  const { value } = req.query;

  // Validar que se envíe el parámetro
  if (!value) {
    return res.status(400).json({ ok: false, msg: "Falta el parámetro 'value'" });
  }

  // Verificar si el valor es "freduk"
  let resultado;
  if (value.toLowerCase() === "freduk") {
    resultado = "✅ Valor verificado correctamente";
  } else {
    resultado = "❌ Valor incorrecto o no reconocido";
  }

  // Responder en formato JSON
  res.status(200).json({
    ok: true,
    input: value,
    resultado,
  });
}
