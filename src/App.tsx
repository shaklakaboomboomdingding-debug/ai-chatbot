/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from "react-markdown";

type Message = {
  id: string;
  role: "user" | "model";
  text: string;
};

const SYSTEM_INSTRUCTION = `You are an intelligent, friendly, and professional AI assistant for a premium restaurant named "Diggin Cafe" located in New Delhi.

Your goal is to:
1. Provide complete and accurate information about the cafe
2. Help customers book tables/seats smoothly
3. Create a warm, aesthetic, and premium brand experience
4. Encourage users to visit or reserve immediately
5. Maximize booking conversions using smart follow-ups and urgency

📍 RESTAURANT DETAILS:
Name: Diggin Cafe
Location: Santushti Shopping Complex, 11, Lok Kalyan Marg, opp. to Samrat Hotel, Chanakyapuri, New Delhi, Delhi, 110021
Contact Number: 9090063232

🎯 YOUR BEHAVIOR:
- Be polite, classy, and slightly aesthetic (matching cafe vibes)
- Keep responses short, helpful, and engaging
- Use emojis occasionally (🌿✨🍝☕) to enhance feel
- Always guide user toward booking or visiting
- Create urgency subtly (without sounding pushy)

💬 WHAT YOU CAN DO:

1. 📖 Provide Information
- About cafe ambience, vibe, food, timings (if not known, say "Please confirm on call")
- Give directions using Google Maps suggestion
- Share contact details when needed

2. 🍽️ Table Booking Flow (CORE FUNCTION)
When user wants to book:
- Ask: Name, Number of guests, Date, Time, Contact number
- Add urgency line during booking: "✨ We have limited slots available, especially during peak hours, so I recommend confirming soon."
- Confirm details like:
"✨ Just to confirm:
Name: ___
Guests: ___
Date & Time: ___
Contact: ___
Shall I proceed with your reservation?"
- **CRUCIAL**: Once the user confirms the reservation with all details provided, you MUST include the exact text "[TRIGGER_BOOKING]" anywhere in your final confirmation message. This will automatically notify the restaurant system and secure their seat. 
Example exactly like this: "🎉 Your table request has been noted! [TRIGGER_BOOKING] Our team will contact you shortly to confirm your booking."

📲 WHATSAPP INTEGRATION (HIGH PRIORITY):
- Always suggest WhatsApp for quick confirmation
- Example response: "For instant confirmation and priority booking, you can message us on WhatsApp at 9090063232 📲"

📍 LOCATION HELP
- Provide simple directions
- Suggest searching "Diggin Cafe Chanakyapuri" on Google Maps

❓ FAQs HANDLING
- Parking → "Yes, parking is available nearby."
- Best time → "Evenings are magical ✨ but weekends can be busy, so booking is recommended."
- Menu → "You’ll love our Italian & continental dishes 🍝"

🚀 CONVERSION STRATEGY (VERY IMPORTANT)
- Always include urgency: "We’re almost fully booked for that time ✨" or "Limited cozy spots left 🌿"
- Always end with CTA like: "Would you like me to book a table for you?" or "Shall I reserve a cozy spot for you? 🌿"

🚫 RULES:
- Do NOT give wrong info if unsure
- Do NOT sound robotic
- Always maintain a premium and aesthetic tone
- ALWAYS use "[TRIGGER_BOOKING]" exactly when a booking is confirmed by the user.`;

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "model",
      text: "Hey! 🌿 Welcome to Diggin Cafe ✨ \nPlanning a cozy visit? I can reserve a beautiful spot for you 💫 \n\nJust tell me your preferred date & time 💛",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const aiClientRefs = useRef<any>(null); // To store chat session

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Init Gemini Chat Session
  useEffect(() => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY is not defined");
        return;
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const chatOptions = {
        model: "gemini-3.1-flash-lite-preview",
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7,
        }
      };
      
      aiClientRefs.current = ai.chats.create(chatOptions);
    } catch (e) {
      console.error("Error creating AI chat session", e);
    }
  }, []);

  const triggerRestaurantNotification = (timeStr?: string) => {
    setToastMessage(`✅ Seat booked! The restaurant has received your booking${timeStr ? ` for ${timeStr}` : ''}.`);
    setTimeout(() => setToastMessage(""), 6000);
  };

  const handleSend = async (e?: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault();
    const userMessage = customMsg || input.trim();
    if (!userMessage || isLoading) return;

    if (!customMsg) setInput("");
    
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", text: userMessage },
    ]);
    
    setIsLoading(true);

    try {
      if (!aiClientRefs.current) {
        throw new Error("Chat session not initialized");
      }

      // We maintain the conversation via sdk natively
      const responseStream = await aiClientRefs.current.sendMessageStream({ message: userMessage });
      
      const modelMessageId = (Date.now() + 1).toString();
      
      setMessages((prev) => [
        ...prev,
        { id: modelMessageId, role: "model", text: "" },
      ]);
      
      let fullText = "";
      for await (const chunk of responseStream) {
        fullText += chunk.text || "";
        
        let displayText = fullText;
        // Check for the trigger keyword
        if (fullText.includes("[TRIGGER_BOOKING]")) {
          displayText = fullText.replace(/\[TRIGGER_BOOKING\]/g, "");
          if (!toastMessage) {
             triggerRestaurantNotification();
          }
        }
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === modelMessageId ? { ...msg, text: displayText } : msg
          )
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "model",
          text: "I'm sorry, I'm having trouble connecting right now. Please call us at 9090063232 🌿",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const date = formData.get("date") as string;
    const time = formData.get("time") as string;
    const guests = formData.get("guests") as string;
    
    setIsModalOpen(false);
    triggerRestaurantNotification(`${date} at ${time}`);
    handleSend(undefined, `I have booked a table for ${guests} on ${date} at ${time} through the quick reservation button.`);
  };

  return (
    <div className="h-screen flex flex-col font-sans overflow-hidden bg-bg-main text-text-secondary select-none md:select-auto relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-accent text-[#0a0c0b] px-6 py-3 rounded-md shadow-[0_10px_40px_rgba(197,160,89,0.3)] font-medium text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          {toastMessage}
        </div>
      )}

      {/* Reservation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0c0b]/80 backdrop-blur-sm">
          <div className="bg-bg-elevated border border-accent/20 rounded-xl p-8 max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-text-secondary/50 hover:text-text-primary transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <h2 className="text-2xl font-serif text-text-primary italic mb-2 tracking-tight">Reserve a Table</h2>
            <p className="text-sm opacity-70 mb-6">Instantly securely book your spot at Diggin Cafe.</p>
            
            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-widest opacity-60">Full Name</label>
                <input required type="text" className="w-full bg-bg-surface border border-accent/20 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-text-primary" placeholder="Your name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-widest opacity-60">Date</label>
                  <input required name="date" type="date" className="w-full bg-bg-surface border border-accent/20 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-text-primary" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-widest opacity-60">Time</label>
                  <input required name="time" type="time" className="w-full bg-bg-surface border border-accent/20 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-text-primary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-widest opacity-60">Guests</label>
                  <select required name="guests" className="w-full bg-bg-surface border border-accent/20 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-text-primary">
                    <option>1 Person</option>
                    <option>2 People</option>
                    <option>3 People</option>
                    <option>4 People</option>
                    <option>5+ People</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-widest opacity-60">Phone</label>
                  <input required type="tel" className="w-full bg-bg-surface border border-accent/20 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-text-primary" placeholder="Phone number" />
                </div>
              </div>
              <button type="submit" className="w-full bg-accent text-[#0a0c0b] font-bold uppercase tracking-wider py-3 rounded-md hover:bg-[#d4b57a] transition-colors mt-6">
                Confirm Booking
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-accent/20 bg-bg-elevated sticky top-0 z-20 shrink-0 shadow-md">
        <div className="flex flex-col">
          <h1 className="text-2xl md:text-3xl font-serif tracking-tight italic text-text-primary">Diggin Cafe</h1>
          <p className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] opacity-60 font-semibold mt-1">Chanakyapuri, New Delhi</p>
        </div>
        <div className="flex gap-4 md:gap-6 items-center">
          <span className="hidden md:inline-block px-3 py-1 border border-accent/30 rounded-full text-[11px] font-medium text-accent">OPEN UNTIL 11:00 PM</span>
          <button onClick={() => setIsModalOpen(true)} className="bg-accent text-text-inverse px-4 md:px-5 py-2 rounded-sm text-[10px] md:text-xs font-bold uppercase tracking-wider hover:bg-[#d4b57a] transition-colors shadow-[0_0_15px_rgba(197,160,89,0.2)]">Reserve Now</button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden flex-col md:flex-row relative">
        
        {/* Left Sidebar (Desktop) */}
        <section className="hidden lg:flex w-[320px] border-r border-accent/10 bg-bg-secondary p-8 flex-col justify-between z-10 shrink-0 h-full overflow-y-auto">
          <div>
            <div className="mb-8">
              <h2 className="text-xs uppercase tracking-widest text-accent font-bold mb-4">The Vibe</h2>
              <p className="font-serif text-lg leading-relaxed italic text-text-primary">“Magical evenings under a canopy of fairy lights and lush greenery.”</p>
            </div>
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 mt-1 opacity-70 italic text-lg leading-none">📍</div>
                <div>
                  <p className="text-[13px] font-medium leading-snug">Santushti Shopping Complex, Lok Kalyan Marg, Chanakyapuri</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 mt-1 opacity-70 text-lg leading-none">🌿</div>
                <div>
                  <p className="text-[13px] font-medium leading-snug">Italian & Continental Classics</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-accent">
                <div className="w-4 h-4 mt-1 text-lg leading-none">✨</div>
                <div>
                  <p className="text-[13px] font-bold leading-snug">Highly recommended for date nights and cozy gatherings.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-accent/10">
            <p className="text-[11px] opacity-40 uppercase tracking-widest mb-2">Instant Support</p>
            <p className="text-xl font-serif tracking-widest text-text-primary">9090063232</p>
          </div>
        </section>

        {/* Chat Area */}
        <section className="flex-1 flex flex-col bg-bg-main relative min-w-0 h-full">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at center, var(--color-accent) 1px, transparent 1px)", backgroundSize: "24px 24px" }}></div>
          
          <div className="flex-1 p-4 md:p-8 flex flex-col gap-6 relative z-10 overflow-y-auto w-full max-w-4xl mx-auto scroll-smooth h-full">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex w-full ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[90%] md:max-w-[80%] p-4 md:p-5 text-[14px] md:text-[15px] leading-relaxed tracking-wide shadow-sm ${
                    msg.role === "user"
                      ? "bg-accent/10 border border-accent/40 text-text-primary rounded-2xl rounded-tr-none text-right"
                      : "bg-bg-surface border border-accent/10 shadow-xl text-text-secondary rounded-2xl rounded-tl-none"
                  }`}
                >
                  {msg.role === "model" ? (
                    <div className="markdown-body text-[14px] md:text-[15px]">
                      {msg.text.length > 0 ? (
                         <ReactMarkdown>{msg.text}</ReactMarkdown>
                      ) : (
                        <div className="flex space-x-1.5 h-6 items-center">
                          <div className="w-1.5 h-1.5 bg-accent/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-1.5 h-1.5 bg-accent/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-1.5 h-1.5 bg-accent/40 rounded-full animate-bounce"></div>
                        </div>
                      )}
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 md:p-6 bg-bg-elevated border-t border-accent/20 z-10 shrink-0">
            <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-3 md:gap-4 items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your details here..."
                disabled={isLoading}
                className="flex-1 bg-[#1a1e1c] border border-accent/20 rounded-full px-5 py-3 md:px-6 md:py-3.5 md:text-sm text-[15px] focus:outline-none focus:border-accent placeholder:opacity-30 text-text-primary transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-12 h-12 md:w-14 md:h-14 shrink-0 bg-accent rounded-full flex items-center justify-center text-text-inverse hover:bg-[#d4b57a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              </button>
            </form>
            <div className="max-w-4xl mx-auto flex flex-wrap gap-2 md:gap-4 mt-4 justify-center md:justify-start">
              <button type="button" onClick={() => handleSend(undefined, "Can I see the menu?")} className="text-[10px] md:text-xs uppercase tracking-wider px-3 py-1.5 md:px-4 md:py-2 bg-bg-surface border border-accent/20 rounded-full hover:bg-[#1f2421] text-text-secondary transition-colors">View Menu 🍝</button>
              <button type="button" onClick={() => handleSend(undefined, "How do I get there?")} className="text-[10px] md:text-xs uppercase tracking-wider px-3 py-1.5 md:px-4 md:py-2 bg-bg-surface border border-accent/20 rounded-full hover:bg-[#1f2421] text-text-secondary transition-colors">Get Directions 📍</button>
            </div>
          </div>
        </section>

        {/* Right Sidebar (Desktop) */}
        <aside className="hidden xl:flex w-[160px] border-l border-accent/10 bg-bg-secondary p-6 flex-col items-center z-10 shrink-0 justify-center">
          <h3 className="text-[10px] uppercase tracking-[0.2em] opacity-40 font-bold mb-8 [writing-mode:vertical-rl] rotate-180">RESERVATION STATUS</h3>
          <div className="w-1 bg-accent/10 h-32 rounded-full mb-8 flex flex-col justify-end overflow-hidden">
             <div className="h-1/3 w-full bg-accent rounded-full animate-pulse"></div>
          </div>
          <div className="space-y-8 flex flex-col items-center">
            <div className="flex flex-col items-center opacity-40">
              <div className="text-[10px] mb-2 font-mono">01</div>
              <div className="w-2 h-2 rounded-full bg-accent"></div>
            </div>
            <div className="flex flex-col items-center relative">
              <div className="text-[10px] mb-2 font-bold text-accent font-mono z-10">02</div>
               <div className="w-3 h-3 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)] z-10 relative"></div>
               <div className="absolute top-5 w-5 h-5 rounded-full bg-accent/20 animate-ping"></div>
            </div>
            <div className="flex flex-col items-center opacity-40">
              <div className="text-[10px] mb-2 font-mono">03</div>
              <div className="w-2 h-2 rounded-full bg-white/20"></div>
            </div>
          </div>
        </aside>

      </main>
      
      {/* Footer Banner */}
      <footer className="h-10 md:h-12 shrink-0 bg-accent text-text-inverse flex items-center justify-center gap-4 md:gap-8 px-4 md:px-10 z-20">
        <div className="text-[9px] md:text-[11px] font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] truncate">Limited cozy spots left for tonight 🌿</div>
        <div className="w-1.5 h-1.5 rounded-full bg-text-inverse/40 shrink-0 hidden sm:block"></div>
        <div className="text-[9px] md:text-[11px] font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] truncate hidden sm:block">Fastest confirmation via WhatsApp: 9090063232</div>
      </footer>
    </div>
  );
}

