import http from "node:http";

const { OPENAI_API_KEY, META_VERIFY_TOKEN, META_ACCESS_TOKEN, META_PHONE_NUMBER_ID } = process.env;
const META_WABA_ID = "767216649494332";
const GRAPH_VERSION = "v25.0";
const conversations = new Map();
const stickerRates = `Paper Gumming stickers: 12x18 minimum 30 sheets at Rs25 each; 100 at Rs20; 250 at Rs14; 500 at Rs13; 1000 at Rs10; 2000 at Rs9. 13x19 minimum 30 at Rs26; 100 at Rs21; 250 at Rs16; 500 at Rs14; 1000 at Rs11; 2000 at Rs10. Vinyl/transparent: 12x18 minimum 30 at Rs35; 100 at Rs30; 500 at Rs25; 1000 at Rs22; 2000 at Rs17.50. 13x19: 30 at Rs36; 100 at Rs31; 500 at Rs26; 1000 at Rs23; 2000 at Rs18.50.`;
const instructions = `You are the respectful WhatsApp sales assistant for Perfect Printings. Reply in the same language as the customer: Hindi/Hinglish for Hindi/Hinglish and English for English. Have a natural, helpful conversation; never say you are a bot. CRITICAL: speak like a human on WhatsApp, with short replies and only ONE question at a time. Never send a long checklist, rate-table text, or many questions in one message. For a first sticker enquiry, reply only: "Bilkul, stickers mil jayenge 😊 Paper Gumming chahiye ya Vinyl/Transparent?" After the customer selects material, ask only the size; after size, ask only quantity; after quantity, give the applicable concise rate. Tell quality, production time, delivery time, GST or design information only when the customer asks. Perfect Printings offers labels, stickers, visiting cards, letterheads, garment tags, digital printing, diaries, corporate gift items, paper bags, jute bags, T-shirts, pamphlets, menu cards, brochures and other printing work. Ask only relevant details: product, quantity, size, material/paper, print sides/colours, finishing, ready design/matter, deadline and delivery pincode/address or pickup preference. For samples or previous work share Instagram @perfectprintings.in. When useful, suggest ordering from https://perfectprintings.in/. For location share https://maps.app.goo.gl/YLNYoGmEhyyTEEM29. Shop hours: 10 AM to 9 PM; Sunday, Diwali, Holi and Rakhi are holidays. Delivery is all over India; production usually takes 3-5 working days and delivery charges vary by location. No discount is allowed. Design-ready files accepted: PDF, JPEG, PNG, and CDR version 16. If no design is available, design charges are usually Rs200-Rs600 depending on time. GST bill is available only on request. No refund after order placement; replacement requests need admin review. ${stickerRates} For rates not stated here, corporate gifts, or unclear specifications, do not invent a price. Politely collect item, quantity, print requirement and location, and say the team will share the exact quotation. Take 50% advance only after the customer agrees to an exact quote. Never claim payment or an order is confirmed; the team verifies it. Keep replies concise and warm for WhatsApp.`;

function send(res, status, body) { res.writeHead(status, { "Content-Type": "text/plain" }); res.end(body); }

function extractResponseText(result) {
  if (typeof result.output_text === "string" && result.output_text.trim()) return result.output_text.trim();
  const text = (result.output || []).flatMap(item => item.content || []).map(part => {
    if (typeof part.text === "string") return part.text;
    if (typeof part.text?.value === "string") return part.text.value;
    if (typeof part.value === "string") return part.value;
    return "";
  }).filter(Boolean).join("\n").trim();
  return text;
}

async function ensureWhatsAppSubscription() {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_WABA_ID}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  console.log("WhatsApp webhook subscription is active");
}

async function replyToCustomer(to, text) {
  const history = conversations.get(to) || [];
  history.push(`Customer: ${text}`);
  const ai = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-5-mini", instructions, input: history.slice(-10).join("\n") }) });
  const result = await ai.json();
  if (!ai.ok) throw new Error(JSON.stringify(result));
  const reply = extractResponseText(result) || "Namaste! Perfect Printings mein aapka swagat hai. Aapko kaunsa printing product chahiye?";
  history.push(`Assistant: ${reply}`);
  conversations.set(to, history.slice(-10));
  const sent = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PHONE_NUMBER_ID}/messages`, { method: "POST", headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: reply } }) });
  const sentResult = await sent.json();
  if (!sent.ok) throw new Error(JSON.stringify(sentResult));
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
    try {
      const message = JSON.parse(data)?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (message?.text?.body) replyToCustomer(message.from, message.text.body).catch(console.error);
    } catch (error) { console.error(error); }
  });
}).listen(process.env.PORT || 3000, () => {
  console.log("Perfect Printings agent started");
  ensureWhatsAppSubscription().catch(error => console.error("WhatsApp subscription failed:", error));
});
