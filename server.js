import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const { OPENAI_API_KEY, META_VERIFY_TOKEN, META_ACCESS_TOKEN, META_PHONE_NUMBER_ID } = process.env;
const META_WABA_ID = "767216649494332";
const GRAPH_VERSION = "v25.0";
const PUBLIC_BASE_URL = "https://perfect-printings-whatsapp-agent.onrender.com";
const ADMIN_PHONE_NUMBER = "918966066612";
const PAYMENT_UPI_ID = "shubhamkushwah8966-1@oksbi";
const AI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-terra";
const conversations = new Map();
const customerStates = new Map();
const sentAssets = new Map();
const customerQueues = new Map();
const orderRecords = new Map();
const adminAlertKeys = new Set();
const monitorSessions = new Set();
const stickerRates = `Paper Gumming stickers: 12x18 minimum 30 sheets at Rs25 each; 100 at Rs20; 250 at Rs14; 500 at Rs13; 1000 at Rs10; 2000 at Rs9. 13x19 minimum 30 at Rs26; 100 at Rs21; 250 at Rs16; 500 at Rs14; 1000 at Rs11; 2000 at Rs10. Vinyl/transparent: 12x18 minimum 30 at Rs35; 100 at Rs30; 500 at Rs25; 1000 at Rs22; 2000 at Rs17.50. 13x19: 30 at Rs36; 100 at Rs31; 500 at Rs26; 1000 at Rs23; 2000 at Rs18.50.`;
const stickerSheetCalculations = `Sticker pieces per sheet, MOQ 30 sheets: 12x18 sheet: 1x1=187, 1.5x1.5=77, 1.75x1.75=54, 2x2=40, 2.5x2.5=24, 2.75x2.75=24, 3x3=15, 3.5x3.5=12, 3.75x3.75=8, 4x4=8, 4.5x4.5=6, 4.75x4.75=6, 5x5=6, 5.5x5.5=6, 5.75x5.75=6, 6x6=2, 6.5x6.5=2, 6.75x6.75=2, 7x7=2, 7.5x7.5=2, 7.75x7.75=2, 8x8=2. 13x19 sheet: 1x1=216, 1.5x1.5=96, 1.75x1.75=70, 2x2=54, 2.5x2.5=28, 2.75x2.75=24, 3x3=24, 3.5x3.5=15, 3.75x3.75=12, 4x4=12, 4.5x4.5=8, 4.75x4.75=6, 5x5=6, 5.5x5.5=6, 5.75x5.75=6, 6x6=6, 6.5x6.5=2, 6.75x6.75=2, 7x7=2, 7.5x7.5=2, 7.75x7.75=2, 8x8=2.`;
const workflowRules = `Accuracy rules: answer only what the customer asks, then ask only the next missing detail. Write like a polite human on WhatsApp: short, warm, simple and natural. Prefer phrases such as "Ji bilkul", "Ek minute", "Main confirm karke batata hoon", or "Aap quantity bata dijiye" where they fit. Never sound like a form, never use robotic wording, and never repeat a greeting in the same conversation. Never repeat an answered question, use a long checklist, repeatedly greet, argue, or invent information. Keep every product isolated: Paper Gumming sticker data is only for Paper Gumming, Vinyl/Transparent data is only for Vinyl/Transparent, visiting-card data is only for visiting cards, and corporate-gift data is only for corporate gifts. Never mix product rates, sizes, GSM, MOQ, sheet calculation, printing rules or finishing. Use only approved product data supplied in the prompt or relevant rate card. ${stickerSheetCalculations} If a custom size, special requirement, unusual specification, unclear product, missing rate, missing GSM, missing MOQ, unknown turnaround, payment verification, complaint, or human request needs confirmation, do not guess. Say naturally: "2 minute dijiye, size/details confirm karke batata hoon." Then collect only the useful details: customer name if known, product, material, exact size, quantity, GSM where relevant, single/double side where relevant, design/file, special requirement and delivery pincode/address. For visiting cards: standard size is 90x55 mm; MOQ is 100 cards; printing is full colour. Do not ask colour/B&W. Ask only any missing quantity, single/double side, approved GSM, and design/content. If a customer has no ready design, say design is available and, only if asked, it is approximately Rs400-Rs600 per hour depending on the requirement; never add it to printing charges without confirmation. Do not promise a poor-quality file will print perfectly; request a clearer file where needed. For an existing customer's order-status, printing-status, dispatch or delivery question, never greet again and never guess a status. Reply briefly that status is being confirmed, such as "Ji, aapke order ka status confirm karke batata hoon." Admin-confirmed information is final. Never show internal/admin process to the customer. A general enquiry is not an order: verify applicable product, size, material/GSM, quantity, sides, rate, total, design/file and customer/delivery details before moving it ahead. When the system sends a product catalogue, say only that the catalogue is sent and ask which model/item and quantity the customer needs; do not invent a catalogue rate.`;
const instructions = `You are the respectful WhatsApp sales assistant for Perfect Printings. Reply in the same language as the customer: Hindi/Hinglish for Hindi/Hinglish and English for English. Have a natural, helpful conversation; never say you are a bot. Before every reply, silently review the whole conversation and identify: the product, all details already confirmed, any uploaded design/file, quoted amount, order reference and current order stage. Never lose, contradict, or ask again for a fact already present. Choose the single best next business action before writing. Prioritise the order workflow over casual chat, but never show this internal reasoning to the customer. CRITICAL: speak like a human on WhatsApp, with short replies and only ONE question at a time. If this is a first message containing only a greeting such as hi, hello, hii, namaste or hey, reply exactly: "Namaste ji 😊 Perfect Printings mein aapka swagat hai. Ji sir/madam, aapko kis printing ki need hai?" Do not mention any product, rate, material, quantity, catalogue or any other detail in that greeting. Never send a long checklist, rate-table text, or many questions in one message. Sticker flow: first ask only "Ji, aapko kaunsa sticker chahiye - Paper Gumming, Vinyl ya Transparent?" Do not send both rate cards. After material, ask only the missing size and quantity. Give the exact relevant rate when price is asked or all relevant details are available. Send only that material's rate card when the customer asks for rate/price/rate list. Visiting-card flow: first collect only missing quantity, single/double side, GSM, and lamination requirement. Do not send a price PDF or ask delivery pincode before these details. Once applicable details are known, give the exact rate; only send the rate list if customer asks for it. Once an exact total is stated and the customer confirms the order, directly request 50% advance, send the QR, and ask for payment screenshot. When the conversation includes a System order reference, mention that same order reference briefly in the payment message. Courier is handled manually by the admin after the job is ready. Never invent, calculate, or request courier charges yourself. Wait for the admin's order-complete update, then use only the admin-supplied remaining balance and courier charge. Do not say "2 minutes" for approved standard rates. If a customer uploads an image/PDF and says it is their design, remember it as design received; never ask product/design again if already known. Tell quality, production time, delivery time, GST or design information only when the customer asks. Perfect Printings offers labels, stickers, visiting cards, letterheads, garment tags, digital printing, diaries, corporate gift items, paper bags, jute bags, T-shirts, pamphlets, menu cards, brochures and other printing work. Ask only relevant details: product, quantity, size, material/paper, print sides/colours, finishing, ready design/matter, deadline and delivery pincode/address or pickup preference. For samples or previous work share Instagram @perfectprintings.in. When useful, suggest ordering from https://perfectprintings.in/. For location share https://maps.app.goo.gl/YLNYoGmEhyyTEEM29. Shop hours: 10 AM to 9 PM; Sunday, Diwali, Holi and Rakhi are holidays. Delivery is all over India; production usually takes 3-5 working days and delivery charges vary by location. No discount is allowed. Design-ready files accepted: PDF, JPEG, PNG, and CDR version 16. GST bill is available only on request. No refund after order placement; replacement requests need admin review. ${stickerRates} RATE ESCALATION: If the customer asks any rate that is not exactly stated in the approved data above, or asks for any unfamiliar/out-of-syllabus item, NEVER guess. Begin your draft with the exact marker [[ASK_ADMIN_RATE]]. This marker is only for the software; do not write anything else before it. Take 50% advance only after the customer agrees to an exact quote. Never claim payment or an order is confirmed; the team verifies it. ${workflowRules} Keep replies concise and warm for WhatsApp.`;

function send(res, status, body) { res.writeHead(status, { "Content-Type": "text/plain" }); res.end(body); }

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function monitorPage() {
  const chats = [...conversations.entries()].map(([phone, history]) => {
    const order = orderRecords.get(phone);
    const messages = history.slice(-80).map(line => {
      const [speaker, ...content] = line.split(": ");
      return `<p class="${speaker.toLowerCase()}"><b>${escapeHtml(speaker)}:</b> ${escapeHtml(content.join(": "))}</p>`;
    }).join("");
    return `<section><h2>Customer +${escapeHtml(phone)} ${order ? `• ${escapeHtml(order.id)}` : ""}</h2>${messages || "<p>No messages yet.</p>"}</section>`;
  }).join("") || "<p>No customer chats recorded since the latest deployment.</p>";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="15"><title>Perfect Printings Monitor</title><style>body{font:15px Arial;background:#f5f6f8;color:#18212b;margin:0;padding:24px}h1{margin-top:0}section{background:#fff;border-radius:12px;padding:16px;margin:16px 0;box-shadow:0 1px 5px #0001}h2{font-size:16px;margin:0 0 12px}.customer{background:#e7f8e8;margin-left:15%;padding:8px;border-radius:8px}.assistant{background:#f1f3f5;margin-right:15%;padding:8px;border-radius:8px}.system{font-size:12px;color:#666}</style></head><body><h1>Perfect Printings — Agent Monitor</h1><p>Live refresh: 15 seconds. Latest customer conversations are shown below.</p>${chats}</body></html>`;
}

function monitorLoginPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Perfect Printings Monitor</title><style>body{font:16px Arial;background:#f5f6f8;display:grid;place-items:center;min-height:90vh}.box{background:#fff;padding:28px;border-radius:12px;box-shadow:0 1px 8px #0002;width:300px}input,button{box-sizing:border-box;width:100%;padding:12px;margin-top:10px}button{background:#168b49;color:#fff;border:0;border-radius:7px}</style></head><body><form class="box" method="post" action="/monitor/login"><h2>Perfect Printings Monitor</h2><p>Monitor password daaliye.</p><input name="password" type="password" placeholder="Password" required autofocus><button type="submit">Open monitor</button></form></body></html>`;
}

function authorizeMonitor(req, res) {
  const password = process.env.MONITOR_PASSWORD;
  const session = req.headers.cookie?.match(/monitor_session=([^;]+)/)?.[1];
  if (!password || !session || !monitorSessions.has(session)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(monitorLoginPage());
    return false;
  }
  return true;
}

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

function ensureOrderReference(to, history) {
  if (orderRecords.has(to)) return orderRecords.get(to);
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const sequence = String(orderRecords.size + 1).padStart(3, "0");
  const order = { id: `PP-${date}-${sequence}`, details: history.filter(item => item.startsWith("Customer:")).join("\n") };
  orderRecords.set(to, order);
  return order;
}

function findOrderByReference(reference) {
  return [...orderRecords.entries()].find(([, order]) => order.id === reference);
}

function buildWorkingMemory(history) {
  const transcript = history.join("\n");
  const lower = transcript.toLowerCase();
  const facts = [];
  if (/visiting ?card|business ?card/.test(lower)) facts.push("Product discussed: visiting cards.");
  if (/sticker|gumming|vinyl|transparent/.test(lower)) facts.push("Product discussed: stickers.");
  if (/paper gumming|paper gum/.test(lower)) facts.push("Sticker material confirmed/discussed: Paper Gumming.");
  if (/vinyl|transparent/.test(lower)) facts.push("Sticker material confirmed/discussed: Vinyl/Transparent.");
  if (/\[customer uploaded an (image|pdf\/document|video)/i.test(transcript) || /design (received|mil gaya|bhej)/i.test(lower)) facts.push("Customer has already shared a design/file. Do not ask for the design again.");
  const orderReference = transcript.match(/PP-\d{8}-\d{3}/i)?.[0];
  if (orderReference) facts.push(`Order reference: ${orderReference}.`);
  if (/customer confirmed order|50% advance|payment qr|qr bhej diya/i.test(lower)) facts.push("Order/payment stage has started. Preserve the quoted product, amount and order context; do not restart the enquiry.");
  const quotedLines = history.filter(item => /(?:₹|rs\.?\s*\d|total\s*[:=]?\s*\d)/i.test(item)).slice(-6);
  if (quotedLines.length) facts.push(`Recent quoted-price context (treat as important): ${quotedLines.join(" | ")}`);
  return facts.length ? facts.join("\n") : "No important facts captured yet; use the conversation transcript.";
}

function updateCustomerState(phone, text) {
  const state = customerStates.get(phone) || {};
  const lower = text.toLowerCase();
  if (/visiting ?card|business ?card/.test(lower)) state.product = "visiting cards";
  if (/sticker|gumming|vinyl|transparent/.test(lower)) state.product = "stickers";
  if (/paper gumming|paper gum/.test(lower)) state.material = "Paper Gumming";
  if (/vinyl|transparent/.test(lower)) state.material = "Vinyl/Transparent";
  const size = text.match(/\b\d+(?:\.\d+)?\s*(?:x|×)\s*\d+(?:\.\d+)?\s*(?:inch|in|cm)?\b/i);
  if (size) state.size = size[0];
  const quantity = text.match(/\b\d+\s*(?:sheets?|cards?|pcs?|pieces?)\b/i);
  if (quantity) state.quantity = quantity[0];
  const gsm = text.match(/\b\d{2,3}\s*gsm\b/i);
  if (gsm) state.gsm = gsm[0];
  if (/single[- ]?side|one side/.test(lower)) state.sides = "single side";
  if (/double[- ]?side|both side/.test(lower)) state.sides = "double side";
  if (/without lamination|bina lamination|no lamination/.test(lower)) state.lamination = "without lamination";
  if (/with lamination|lamination chahiye/.test(lower)) state.lamination = "with lamination";
  if (/\[customer uploaded an (image|pdf\/document|video)/i.test(text) || /design (hai|bhej|send|ready)/.test(lower)) state.design = "received/confirmed";
  if (/confirm|final|book|kar do|kr do/.test(lower)) state.customerIntent = "customer wants to confirm";
  customerStates.set(phone, state);
  return state;
}

function formatCustomerState(state) {
  const details = Object.entries(state).map(([key, value]) => `${key}: ${value}`);
  return details.length ? `SAVED CUSTOMER RECORD: ${details.join("; ")}. These facts are FINAL for this order. Never ask any of them again. Example: if lamination says "without lamination", do not ask lamination again; same for quantity, size, GSM, sides, material, design and address.` : "No saved customer record yet.";
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

async function sendImageById(to, mediaId, caption) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { id: mediaId, caption }
    })
  });
  if (!response.ok) throw new Error(await response.text());
}

async function sendTextMessage(to, body) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
}

async function alertAdmin(body) {
  try {
    // Send the useful alert first: customer number, order and requirement must be visible
    // to the owner. This works whenever the admin's WhatsApp conversation is active.
    await sendTextMessage(ADMIN_PHONE_NUMBER, body);
    console.log("Admin detailed text alert sent");
    return;
  } catch (textError) {
    console.error("Admin detailed text alert failed; trying approved template:", textError);
  }
  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: ADMIN_PHONE_NUMBER,
        type: "template",
        template: { name: "admin_rate_alert", language: { code: "en" } }
      })
    });
    if (!response.ok) throw new Error(await response.text());
    console.log("Admin template alert sent");
  } catch (error) {
    console.error("Admin template alert failed:", error);
    try {
      await sendTextMessage(ADMIN_PHONE_NUMBER, body);
      console.log("Admin text alert sent");
    } catch (fallbackError) {
      console.error("Admin text alert failed:", fallbackError);
    }
  }
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

async function sendVideoById(to, mediaId, caption) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "video", video: { id: mediaId, caption } })
  });
  if (!response.ok) throw new Error(await response.text());
}

function moneyFromAdminMessage(text, label) {
  const pattern = new RegExp(`(?:${label})\\s*(?:amount)?\\s*[:=\\-]?\\s*(?:rs\\.?|₹)?\\s*(\\d+(?:\\.\\d{1,2})?)`, "i");
  const match = text.match(pattern);
  const amount = match ? Number(match[1]) : NaN;
  return Number.isFinite(amount) ? amount : null;
}

async function handleAdminOrderUpdate(message) {
  const text = message.text?.body || message.video?.caption || "";
  if (await handleAdminAdvanceConfirmation(text)) return true;
  const reference = text.match(/PP-\d{8}-\d{3}/i)?.[0]?.toUpperCase();
  if (!reference || !/job\s*done|complete|ready/i.test(text)) return false;
  const found = findOrderByReference(reference);
  if (!found) {
    await sendTextMessage(ADMIN_PHONE_NUMBER, `Order ${reference} is not available in the agent's current records. Please resend after the customer order is created.`);
    return true;
  }
  const [customerPhone, order] = found;
  const balance = moneyFromAdminMessage(text, "balance|remaining");
  const courier = moneyFromAdminMessage(text, "courier|delivery");
  if (balance === null || courier === null) {
    await sendTextMessage(ADMIN_PHONE_NUMBER, `For ${reference}, please send: JOB DONE ${reference} | Balance ₹___ | Courier ₹___ and attach the printing video.`);
    return true;
  }
  const payable = balance + courier;
  if (message.video?.id) await sendVideoById(customerPhone, message.video.id, `Order ${reference} ki printing ready hai 😊`);
  await sendTextMessage(customerPhone, `Ji, aapka order ${reference} ready ho gaya hai 😊 Remaining amount ₹${balance} aur courier charge ₹${courier} hai. Total ₹${payable} pay karke screenshot share kar dijiye.`);
  await sendImage(customerPhone, "payment-qr.jpeg", `Order ${reference} final payment QR — ₹${payable}. UPI: ${PAYMENT_UPI_ID}. Payment ke baad screenshot share kar dijiye.`);
  order.status = "final-payment-requested";
  order.finalPayable = payable;
  await sendTextMessage(ADMIN_PHONE_NUMBER, `Final payment request sent to customer for ${reference}: Balance ₹${balance} + Courier ₹${courier} = ₹${payable}.`);
  return true;
}

async function handleAdminAdvanceConfirmation(text) {
  const lower = text.toLowerCase();
  const looksConfirmed = /(?:payment|advance).*(?:received|rec[eie]ved|aa\s*gaya|mil\s*gaya|confirmed)|(?:haa|han|yes|ha)\b.*(?:payment|advance).*(?:aa\s*gaya|mil\s*gaya|received|confirm)/i.test(lower);
  if (!looksConfirmed) return false;
  const reference = text.match(/PP-\d{8}-\d{3}/i)?.[0]?.toUpperCase();
  const candidates = [...orderRecords.entries()].filter(([, order]) => order.status === "awaiting-admin-advance-confirmation");
  const found = reference ? findOrderByReference(reference) : candidates.length === 1 ? candidates[0] : null;
  if (!found) {
    await sendTextMessage(ADMIN_PHONE_NUMBER, "Payment confirmation ke liye order number bhi likh dijiye, jaise: PP-YYYYMMDD-001 PAYMENT RECEIVED.");
    return true;
  }
  const [customerPhone, order] = found;
  if (order.status !== "awaiting-admin-advance-confirmation") return false;
  order.status = "advance-verified-processing";
  order.advanceVerifiedAt = new Date().toISOString();
  await sendTextMessage(customerPhone, `Ji, Order ${order.id} ka advance payment receive ho gaya hai 😊 Aapka order ab process mein laga diya hai.`);
  await sendTextMessage(ADMIN_PHONE_NUMBER, `PAYMENT VERIFIED — PLEASE PROCESS\nOrder: ${order.id}\nCustomer: +${customerPhone}\nAdvance: 50% received\nOrder details:\n${order.details || "Details available in customer chat"}`);
  console.log(`Advance payment verified for ${order.id}`);
  return true;
}

async function requestAdminAdvanceVerification(to, order, mediaId) {
  order.status = "awaiting-admin-advance-confirmation";
  order.paymentScreenshotReceivedAt = new Date().toISOString();
  const note = `PAYMENT VERIFICATION NEEDED\nOrder: ${order.id}\nCustomer: +${to}\nCustomer has shared 50% advance payment screenshot. Please reply exactly:\n${order.id} PAYMENT RECEIVED\nOnly confirm after checking your payment account.\n\nOrder details:\n${order.details || "Details available in customer chat"}`;
  await alertAdmin(note);
  if (mediaId) await sendImageById(ADMIN_PHONE_NUMBER, mediaId, `Payment screenshot received for ${order.id}. Verify payment, then reply: ${order.id} PAYMENT RECEIVED.`).catch(error => console.error("Admin payment screenshot forward failed:", error));
  console.log(`Advance payment verification requested for ${order.id}`);
}

async function sendAssetOnce(to, assetKey, sendAsset) {
  const customerAssets = sentAssets.get(to) || new Set();
  if (customerAssets.has(assetKey)) return;
  await sendAsset();
  customerAssets.add(assetKey);
  sentAssets.set(to, customerAssets);
}

async function replyToCustomer(to, text, mediaId) {
  const history = conversations.get(to) || [];
  history.push(`Customer: ${text}`);
  const customerState = updateCustomerState(to, text);
  const existingOrder = orderRecords.get(to);
  const isUploadedImage = /^\[Customer uploaded an image/i.test(text);
  const isPaymentScreenshot = isUploadedImage && existingOrder?.status === "awaiting-advance-screenshot";
  const isFirstMessage = !history.some(item => item.startsWith("Assistant:"));
  const lowerText = text.toLowerCase();
  const isSticker = /\bsticker(s)?\b|stikers?|gumming|vinyl|transparent/i.test(text);
  const isCorporateGift = /corporate|gift|gifting|diary|pen/i.test(text);
  const isOrderStatusRequest = /order.*(status|update|kya hua|hua|print|printing|dispatch|delivery)|(?:print|printing|dispatch|delivery).*(status|update|kab|hua)|order kab/i.test(lowerText);
  const historyText = history.join(" ").toLowerCase();
  const isRateRequest = /\b(price|rate|rate list|cost|kitna|bhav)\b/i.test(text);
  const isStickerConversation = isSticker || /\bsticker(s)?\b|stikers?/i.test(historyText);
  const isVisitingCardConversation = /visiting ?card|business ?card/i.test(historyText);
  // Only sticker rates are directly stored in the agent. All other products need the
  // owner's live quote instead of an invented price.
  if (isStickerConversation && isRateRequest && /paper gumming|paper gum|gumming/.test(historyText)) await sendAssetOnce(to, "paper-sticker-rate", () => sendImage(to, "paper-gumming-stickers.jpeg", "Paper Gumming sticker rate list. Current advance: 50% after final quote."));
  if (isStickerConversation && isRateRequest && /vinyl|transparent/.test(historyText)) await sendAssetOnce(to, "vinyl-sticker-rate", () => sendImage(to, "vinyl-transparent-stickers.jpeg", "Vinyl / Transparent sticker rate list. Current advance: 50% after final quote."));
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
  if (/visiting ?card|business ?card/.test(lowerText) && /rate list|pdf bhej|price list/i.test(text)) await sendAssetOnce(to, "visiting-cards", () => sendDocument(to, "visiting-card-rate-list.pdf", "Visiting card rate list"));
  const hasQuotedPrice = /rs\.?\s*\d|₹\s*\d|total/i.test(historyText);
  const confirmsOrder = /\b(confirm|confirmed|done|final|book|kar do|kr do|ok)\b/i.test(lowerText);
  const asksForPaymentQr = /\b(qr|upi|payment)\b.*\b(send|bhej|bhjo|share|do)\b|\b(send|bhej|bhjo|share|do)\b.*\b(qr|upi|payment)\b/i.test(lowerText);
  let paymentQrSent = false;
  if (asksForPaymentQr || (hasQuotedPrice && confirmsOrder)) {
    const order = ensureOrderReference(to, history);
    order.details = history.filter(item => item.startsWith("Customer:")).slice(-30).join("\n");
    order.status = "awaiting-advance-screenshot";
    history.push(`System: Customer confirmed order. Order reference ${order.id}.`);
    // A customer may ask for the QR again, so never suppress this payment image.
    await sendImage(to, "payment-qr.jpeg", `Order ${order.id} - 50% advance payment QR. UPI: ${PAYMENT_UPI_ID}. Payment ke baad screenshot share kar dijiye.`);
    sendTextMessage(ADMIN_PHONE_NUMBER, `NEW ORDER REQUEST\nOrder: ${order.id}\nCustomer WhatsApp: +${to}\nDetails:\n${order.details}\n\nCustomer has confirmed. Please verify 50% advance after payment screenshot.`).catch(console.error);
    paymentQrSent = true;
  }
  if (isOrderStatusRequest && to !== ADMIN_PHONE_NUMBER) {
    const recentCustomerDetails = history.filter(item => item.startsWith("Customer:")).slice(-4).join("\n");
    sendTextMessage(ADMIN_PHONE_NUMBER, `ORDER STATUS CHECK\nCustomer WhatsApp: +${to}\nLatest message: ${text}\nRecent details:\n${recentCustomerDetails}\n\nPlease confirm current printing/dispatch status.`).catch(console.error);
  }
  const isGreetingOnly = /^(hi+|hello+|hey+|namaste|namaskar)\s*[!.?😊🙏]*$/i.test(text.trim());
  let reply;
  if (isPaymentScreenshot) {
    const order = orderRecords.get(to);
    await requestAdminAdvanceVerification(to, order, mediaId);
    reply = `Ji, payment screenshot mil gaya 😊 Main payment verify karwa raha hoon. Confirmation aate hi aapko order processing update bhej dunga.`;
  } else if (paymentQrSent) {
    const order = ensureOrderReference(to, history);
    reply = `Ji bilkul 😊 QR bhej diya hai. UPI ID: ${PAYMENT_UPI_ID}. Order ${order.id} ke 50% advance ka payment karke screenshot isi chat mein share kar dijiye.`;
  } else if (isFirstMessage && isGreetingOnly) {
    reply = "Namaste ji 😊 Perfect Printings mein aapka swagat hai. Ji sir/madam, aapko kis printing ki need hai?";
  } else {
    const workingMemory = `${formatCustomerState(customerState)}\n${buildWorkingMemory(history)}`;
    const ai = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: AI_MODEL, reasoning: { effort: "medium" }, instructions, input: `SYSTEM CUSTOMER MEMORY (this is important and must not be contradicted):\n${workingMemory}\n\nFULL RECENT CONVERSATION:\n${history.slice(-120).join("\n")}` }) });
    const result = await ai.json();
    if (!ai.ok) throw new Error(JSON.stringify(result));
    reply = extractResponseText(result) || "Namaste ji 😊 Perfect Printings mein aapka swagat hai. Ji sir/madam, aapko kis printing ki need hai?";
    if (reply.includes("[[ASK_ADMIN_RATE]]")) {
      const details = history.filter(item => item.startsWith("Customer:")).slice(-10).join("\n");
      // The same unknown-rate enquiry must create one owner alert, not a new alert on
      // every customer message. New requirements generate a different key.
      const alertKey = `${to}:${details}`;
      if (!adminAlertKeys.has(alertKey)) {
        adminAlertKeys.add(alertKey);
        alertAdmin(`CUSTOMER RATE HELP NEEDED\nCustomer WhatsApp: +${to}\nCustomer requirement:\n${details}\n\nRate agent ke paas available nahi hai. Please customer se baat kar lijiye aur exact rate confirm kar dijiye.`).catch(console.error);
      }
      reply = "Ji, is requirement ka exact rate Shubham ji se confirm kar raha hoon. 2 minute dijiye, woh aapse baat kar lenge 😊";
    }
  }
  history.push(`Assistant: ${reply}`);
  // Keep enough history for long customer conversations instead of dropping key order facts.
  conversations.set(to, history.slice(-160));
  await sendTextMessage(to, reply);
}

function queueCustomerReply(to, text, mediaId) {
  const previous = customerQueues.get(to) || Promise.resolve();
  const next = previous.catch(() => {}).then(() => replyToCustomer(to, text, mediaId));
  customerQueues.set(to, next);
  next.finally(() => {
    if (customerQueues.get(to) === next) customerQueues.delete(to);
  });
  return next;
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "GET" && url.pathname === "/") return send(res, 200, "Perfect Printings WhatsApp agent is running.");
  if (req.method === "POST" && url.pathname === "/monitor/login") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      const supplied = new URLSearchParams(body).get("password");
      if (process.env.MONITOR_PASSWORD && supplied === process.env.MONITOR_PASSWORD) {
        const session = randomUUID();
        monitorSessions.add(session);
        res.writeHead(302, { Location: "/monitor", "Set-Cookie": `monitor_session=${session}; HttpOnly; SameSite=Strict; Path=/` });
        return res.end();
      }
      res.writeHead(302, { Location: "/monitor" });
      res.end();
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/monitor") {
    if (!authorizeMonitor(req, res)) return;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(monitorPage());
  }
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
      const value = JSON.parse(data)?.entry?.[0]?.changes?.[0]?.value || {};
      const status = value.statuses?.[0];
      if (status) {
        console.log(`WhatsApp delivery status: ${status.status} | recipient: ${status.recipient_id || "unknown"} | error: ${JSON.stringify(status.errors || [])}`);
        return;
      }
      const message = value.messages?.[0];
      if (message?.from === ADMIN_PHONE_NUMBER) {
        handleAdminOrderUpdate(message).catch(console.error);
        return;
      }
      const incomingText = message?.text?.body || (message?.image ? `[Customer uploaded an image${message.image.caption ? `: ${message.image.caption}` : ""}]` : message?.document ? `[Customer uploaded a PDF/document${message.document.caption ? `: ${message.document.caption}` : ""}]` : message?.video ? `[Customer uploaded a video${message.video.caption ? `: ${message.video.caption}` : ""}]` : "");
      if (incomingText) queueCustomerReply(message.from, incomingText, message?.image?.id).catch(console.error);
    } catch (error) { console.error(error); }
  });
}).listen(process.env.PORT || 3000, () => {
  console.log("Perfect Printings agent started");
  ensureWhatsAppSubscription().catch(error => console.error("WhatsApp subscription failed:", error));
});
