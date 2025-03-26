require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

// ✅ Configura CORS para aceptar peticiones desde Shopify
app.use(cors({
  origin: "https://surfin-store-spain.myshopify.com" // ← reemplaza con el dominio de tu tienda real
}));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const shopifyAxios = axios.create({
  baseURL: `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2023-07`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_API_KEY,
    'Content-Type': 'application/json'
  }
});

// Función para obtener productos de Shopify
async function getProducts() {
  const res = await shopifyAxios.get('/products.json?limit=10');
  return res.data.products;
}

// Endpoint del chatbot
app.post("/ask", async (req, res) => {
  const { question } = req.body;

  try {
    const products = await getProducts();
    const context = products.map(p => `${p.title}: ${p.body_html}`).join("\n");

    const prompt = `
Eres un asistente experto en skate, snowboard y ropa urbana. El cliente te pregunta qué producto debería comprar. Usa los siguientes datos para responder con precisión. No inventes datos. Si no sabes, di "Déjame comprobarlo".

Productos disponibles:
${context}

Pregunta del cliente:
${question}
    `;

    const gptRes = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }]
    });

    res.json({ reply: gptRes.choices[0].message.content });

  } catch (error) {
    console.error("Error al procesar la solicitud:", error.message);
    res.status(500).json({ error: "Hubo un error con el chatbot." });
  }
});

// Iniciar servidor
app.listen(3000, () => console.log("Bot activo en http://localhost:3000"));
