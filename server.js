import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const { OPENAI_API_KEY, META_VERIFY_TOKEN, META_ACCESS_TOKEN, META_PHONE_NUMBER_ID } = process.env;
const META_WABA_ID = "767216649494332";
const GRAPH_VERSION = "v25.0";
const PUBLIC_BASE_URL = "https://perfect-printings-whatsapp-agent.onrender.com";
const conversations = new Map();
const sentAssets = new Map();
const stickerRates = `Paper Gumming stickers: 12x18 minimum 30 sheets at Rs25 each; 100 at Rs20; 250 at Rs14; 500 at Rs13; 1000 at Rs10; 2000 at Rs9. 13x19 minimum 30 at Rs26; 100 at Rs21; 250 at Rs16; 500 at Rs14; 1000 at Rs11; 2000 at Rs10. Vinyl/transparent: 12x18 minimum 30 at Rs35; 100 at Rs30; 500 at Rs25; 1000 at Rs22; 2000 at Rs17.50. 13x19: 30 at Rs36; 100 at Rs31; 500 at Rs26; 1000 at Rs23; 2000 at Rs18.50.`;
const stickerSheetCalculations = `Sticker pieces per sheet, MOQ 30 sheets: 12x18 sheet: 1x1=187, 1.5x1.5=77, 1.75x1.75=54, 2x2=40, 2.5x2.5=24, 2.75x2.75=24, 3x3=15, 3.5x3.5=12, 3.75x3.75=8, 4x4=8, 4.5x4.5=6, 4.75x4.75=6, 5x5=6, 5.5x5.5=6, 5.75x5.75=6, 6x6=2, 6.5x6.5=2, 6.75x6.75=2, 7x7=2, 7.5x7.5=2, 7.75x7.75=2, 8x8=2. 13x19 sheet: 1x1=216, 1.5x1.5=96, 1.75x1.75=70, 2x2=54, 2.5x2.5=28, 2.75x2.75=24, 3x3=24, 3.5x3.5=15, 3.75x3.75=12, 4x4=12, 4.5x4.5=8, 4.75x4.75=6, 5x5=6, 5.5x5.5=6, 5.75x5.75=6, 6x6=6, 6.5x6.5=2, 6.75x6.75=2, 7x7=2, 7.5x7.5=2, 7.75x7.75=2, 8x8=2.`;
const workflowRules = `Accuracy rules: answer only what the customer asks, then ask only the next missing detail. Never repeat an answered question, use a long checklist, repeatedly greet, argue, or invent information. Keep every product isolated: Paper Gumming sticker data is only for Paper Gumming, Vinyl/Transparent data is only for Vinyl/Transparent, visiting-card data is only for visiting cards, and corporate-gift data is only for corporate gifts. Never mix product rates, sizes, GSM, MOQ, sheet calculation, printing rules or finishing. Use only approved product data supplied in the prompt or relevant rate card. ${stickerSheetCalculations} If a custom size, special requirement, unusual specification, unclear product, missing rate, missing GSM, missing MOQ, unknown turnaround, payment verification, complaint, or human request needs confirmation, do not guess. Say naturally: "2 minute dijiye, size/details confirm karke batata hoon." Then collect only the useful details: customer name if known, product, material, exact size, quantity, GSM where relevant, single/double side where relevant, design/file, special requirement and delivery pincode/address. For visiting cards: standard size is 90x55 mm; MOQ is 100 cards; printing is full colour. Do not ask colour/B&W. Ask only any missing quantity, single/double side, approved GSM, and design/content. If a customer has no ready design, say design is available and, only if asked, it is approximately Rs400-Rs600 per hour depending on the requirement; never add it to printing charges without confirmation. Do not promise a poor-quality file will print perfectly; request a clearer file where needed. Admin-confirmed information is final. Never show internal/admin process to the customer. A general enquiry is not an order: verify applicable product, size, material/GSM, quantity, sides, rate, total, design/file and customer/delivery details before moving it ahead. When the system sends a product catalogue, say only that the catalogue is sent and ask which model/item and quantity the customer needs; do not invent a catalogue rate.`;
const instructions = `You are the respectful WhatsApp sales assistant for Perfect Printings. Reply in the same language as the customer: Hindi/Hinglish for Hindi/Hinglish and English for English. Have a natural, helpful conversation; never say you are a bot. CRITICAL: speak like a human on WhatsApp, with short replies and only ONE question at a time. If this is a first message containing only a greeting such as hi, hello, hii, namaste or hey, reply exactly: "Namaste ji 😊 Perfect Printings mein aapka swagat hai. Ji sir/madam, aapko kis printing ki need hai?" Do not mention any product, rate, material, quantity, catalogue or any other detail in that greeting. Never send a long checklist, rate-table text, or many questions in one message. For a first sticker enquiry, the system sends two rate-card images. Reply only: "Bilkul, dono rate cards bhej diye 😊 Paper Gumming chahiye ya Vinyl/Transparent?" After the customer selects material, ask only the size; after size, ask only quantity; after quantity, give the applicable concise rate. Tell quality, production time, delivery time, GST or design information only when the customer asks. Perfect Printings offers labels, stickers, visiting cards, letterheads, garment tags, digital printing, diaries, corporate gift items, paper bags, jute bags, T-shirts, pamphlets, menu cards, brochures and other printing work. Ask only relevant details: product, quantity, size, material/paper, print sides/colours, finishing, ready design/matter, deadline and delivery pincode/address or pickup preference. For samples or previous work share Instagram @perfectprintings.in. When useful, suggest ordering from https://perfectprintings.in/. For location share https://maps.app.goo.gl/YLNYoGmEhyyTEEM29. Shop hours: 10 AM to 9 PM; Sunday, Diwali, Holi and Rakhi are holidays. Delivery is all over India; production usually takes 3-5 working days and delivery charges vary by location. No discount is allowed. Design-ready files accepted: PDF, JPEG, PNG, and CDR version 16. GST bill is available only on request. No refund after order placement; replacement requests need admin review. ${stickerRates} For rates not stated here, corporate gifts, or unclear specifications, do not invent a price. Politely collect item, quantity, print requirement and location, and say the team will share the exact quotation. Take 50% advance only after the customer agrees to an exact quote. Never claim payment or an order is confirmed; the team verifies it. ${workflowRules} Keep replies concise and warm for WhatsApp.`;

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

async function sendImage(to, fileName, caption) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: `${PUBLIC_BASE_URL}/assets/${fileName}`, caption }
    })
  });
  if (!response.ok) throw new Error(await response.text());
}

async function sendDocument(to, fileName, caption) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: { link: `${PUBLIC_BASE_URL}/assets/${fileName}`, filename: fileName, caption }
    })
  });
  if (!response.ok) throw new Error(await response.text());
}

async function sendAssetOnce(to, assetKey, sendAsset) {
  const customerAssets = sentAssets.get(to) || new Set();
  if (customerAssets.has(assetKey)) return;
  await sendAsset();
  customerAssets.add(assetKey);
  sentAssets.set(to, customerAssets);
}

async function replyToCustomer(to, text) {
  const history = conversations.get(to) || [];
  history.push(`Customer: ${text}`);
  const isFirstMessage = !history.some(item => item.startsWith("Assistant:"));
  const lowerText = text.toLowerCase();
  const isSticker = /\bsticker(s)?\b|stikers?|gumming|vinyl|transparent/i.test(text);
  const isCorporateGift = /corporate|gift|gifting|diary|pen/i.test(text);
  if (isFirstMessage && isSticker) {
    await Promise.all([
      sendAssetOnce(to, "paper-sticker-rate", () => sendImage(to, "paper-gumming-stickers.jpeg", "Paper Gumming sticker rate list. Current advance: 50% after final quote.")),
      sendAssetOnce(to, "vinyl-sticker-rate", () => sendImage(to, "vinyl-transparent-stickers.jpeg", "Vinyl / Transparent sticker rate list. Current advance: 50% after final quote."))
    ]);
  }
  if (isFirstMessage && isCorporateGift) {
    await sendAssetOnce(to, "corporate-gift-preview", () => sendImage(to, "corporate-gifts.jpg", "Corporate gifting sample catalogue"));
  }
  if (isSticker && /sheet.*kitne|kitne.*sheet|calculation|per sheet|sheet count/i.test(text)) {
    if (/13\s*[x×]\s*19/i.test(text)) await sendAssetOnce(to, "sticker-count-13x19", () => sendImage(to, "sticker-sheet-count-13x19.jpeg", "13x19 sticker sheet calculation (MOQ: 30 sheets)."));
    if (/12\s*[x×]\s*18/i.test(text)) await sendAssetOnce(to, "sticker-count-12x18", () => sendImage(to, "sticker-sheet-count-12x18.jpeg", "12x18 sticker sheet calculation (MOQ: 30 sheets)."));
  }
  if (/\b(metal )?pen(s)?\b/.test(lowerText)) await sendAssetOnce(to, "metal-pens", () => sendDocument(to, "metal-pens-catalogue.pdf", "Metal pens catalogue - please share selected model and quantity."));
  if (/notebook|diar(y|ies)|journal/.test(lowerText)) await sendAssetOnce(to, "notebooks", () => sendDocument(to, "notebook-catalogue.pdf", "Notebook catalogue - please share selected model and quantity."));
  if (/key ?chain/.test(lowerText)) await sendAssetOnce(to, "keychains", () => sendDocument(to, "metal-keychains-catalogue.pdf", "Metal keychains catalogue - please share selected model and quantity."));
  if (/corporate.*gift|gift.*set/.test(lowerText)) await sendAssetOnce(to, "gift-sets", () => sendDocument(to, "corporate-gift-sets-catalogue.pdf", "Corporate gift sets catalogue - please share selected set and quantity."));
  if (/miscellaneous|desk ?item|clock|mobile ?stand|card ?holder/.test(lowerText)) await sendAssetOnce(to, "misc-items", () => sendDocument(to, "miscellaneous-items-catalogue.pdf", "Promotional items catalogue - please share selected item and quantity."));
  if (/visiting ?card|business ?card/.test(lowerText)) await sendAssetOnce(to, "visiting-cards", () => sendDocument(to, "visiting-card-rate-list.pdf", "Visiting card rate list - please share GSM, quantity and single/double side."));
  if (/\b(qr|upi|payment|pay|advance)\b/.test(lowerText)) await sendAssetOnce(to, "payment-qr", () => sendImage(to, "payment-qr.jpeg", "Payment QR - please share payment screenshot after paying."));
  const isGreetingOnly = /^(hi+|hello+|hey+|namaste|namaskar)\s*[!.?😊🙏]*$/i.test(text.trim());
  let reply;
  if (isFirstMessage && isGreetingOnly) {
    reply = "Namaste ji 😊 Perfect Printings mein aapka swagat hai. Ji sir/madam, aapko kis printing ki need hai?";
  } else {
    const ai = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-5-mini", instructions, input: history.slice(-10).join("\n") }) });
    const result = await ai.json();
    if (!ai.ok) throw new Error(JSON.stringify(result));
    reply = extractResponseText(result) || "Namaste ji 😊 Perfect Printings mein aapka swagat hai. Ji sir/madam, aapko kis printing ki need hai?";
  }
  history.push(`Assistant: ${reply}`);
  conversations.set(to, history.slice(-10));
  const sent = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PHONE_NUMBER_ID}/messages`, { method: "POST", headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: reply } }) });
  const sentResult = await sent.json();
  if (!sent.ok) throw new Error(JSON.stringify(sentResult));
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "GET" && url.pathname === "/") return send(res, 200, "Perfect Printings WhatsApp agent is running.");
  const assetName = path.basename(url.pathname);
  const availableAssets = new Set(["corporate-gifts.jpg", "paper-gumming-stickers.jpeg", "vinyl-transparent-stickers.jpeg", "payment-qr.jpeg", "sticker-sheet-count-12x18.jpeg", "sticker-sheet-count-13x19.jpeg", "metal-pens-catalogue.pdf", "notebook-catalogue.pdf", "corporate-gift-sets-catalogue.pdf", "miscellaneous-items-catalogue.pdf", "metal-keychains-catalogue.pdf", "visiting-card-rate-list.pdf"]);
  if (req.method === "GET" && url.pathname.startsWith("/assets/") && availableAssets.has(assetName)) {
    res.writeHead(200, { "Content-Type": assetName.endsWith(".pdf") ? "application/pdf" : "image/jpeg" });
    return fs.createReadStream(path.join(process.cwd(), "assets", assetName)).pipe(res);
  }
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
