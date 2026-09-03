import http from "node:http";

const { OPENAI_API_KEY, META_VERIFY_TOKEN, META_ACCESS_TOKEN, META_PHONE_NUMBER_ID } = process.env;
const instructions = `You are the friendly WhatsApp customer-support assistant for Perfect Printings. Reply in Hindi/Hinglish unless the customer writes in English. Understand the required printing service and ask only useful questions: quantity, size, material, deadline, and delivery location. Never invent prices, delivery times, discounts, availability, or policies. If pricing is not provided, say the Perfect Printings team will share the exact quotation shortly. Never say an order is placed or payment is received. If a customer asks for a human, has a complaint, or has an urgent issue, say the team will assist them. Keep replies short and helpful for WhatsApp.`;

function send(res, status, body) { res.writeHead(status, { "Content-Type": "text/plain" }); res.end(body); }

async function replyToCustomer(to, text) {
  const ai = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-5-mini", instructions, input: text }) });
  const result = await ai.json();
  const reply = result.output_text || "Thank you. Perfect Printings team will assist you shortly.";
  await fetch(`https://graph.facebook.com/v22.0/${META_PHONE_NUMBER_ID}/messages`, { method: "POST", headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: reply } }) });
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "GET" && url.pathname === "/") return send(res, 200, "Perfect Printings WhatsApp agent is running.");
  if (req.method === "GET" && url.pathname === "/webhook") {
    if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === META_VERIFY_TOKEN) return send(res, 200, url.searchParams.get("hub.challenge") || "");
    return send(res, 403, "Verification failed");
  }
  if (req.method !== "POST" || url.pathname !== "/webhook") return send(res, 404, "Not found");
  let data = "";
  req.on("data", chunk => { data += chunk; });
  req.on("end", () => {
    send(res, 200, "OK");
    try { const message = JSON.parse(data)?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]; if (message?.text?.body) replyToCustomer(message.from, message.text.body).catch(console.error); } catch (error) { console.error(error); }
  });
}).listen(process.env.PORT || 3000, () => console.log("Perfect Printings agent started"));
