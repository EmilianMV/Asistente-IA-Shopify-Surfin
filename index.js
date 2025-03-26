require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const OpenAI = require("openai");

const app = express();
app.use(express.json());
app.use(cors());
app.options("*", cors());

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

// Obtener productos activos y con variantes en stock
async function getAvailableProducts() {
  const res = await shopifyAxios.get('/products.json?limit=10');
  const products = res.data.products;

  return products
    .filter(p => p.variants.some(v => v.inventory_quantity > 0))
    .map(p => ({
      title: p.title,
      description: p.body_html.replace(/<[^>]+>/g, '').slice(0, 100) + "...",
      image: p.images[0]?.src || "https://via.placeholder.com/100",
      url: `https://${process.env.SHOPIFY_STORE_DOMAIN.replace('.myshopify.com', '')}.com/products/${p.handle}`
    }));
}

app.post("/ask", async (req, res) => {
  const { question } = req.body;

  try {
    const products = await getAvailableProducts();
    const context = products.map(p => `${p.title}: ${p.description}`).join("\n");

    const prompt = `
Eres un asesor experto de una tienda de skate, snowboard y ropa urbana. Recomienda productos según lo que el cliente busca. A continuación tienes algunos productos disponibles:

${context}

Pregunta del cliente:
${question}
`;

    const gptRes = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }]
    });

    res.json({
      reply: gptRes.choices[0].message.content,
      products: products
    });

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Error al procesar la solicitud del chatbot." });
  }
});

app.listen(3000, () => console.log("Bot activo en Render"));
