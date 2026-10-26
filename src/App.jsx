
import { useState } from "react";
import "./App.css";
import { jsPDF } from "jspdf";

const exhibitions = [
  {
    number: "01",
    category: "ANCIENT CIVILIZATION",
    title: "Echoes of Egypt",
    description: "Discover the mysteries, symbols and stories of an ancient world.",
    image:
      "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?auto=format&fit=crop&w=900&q=85",
    color: "gold",
  },
  {
    number: "02",
    category: "ART & CULTURE",
    title: "Beyond the Canvas",
    description: "Explore extraordinary works that changed the way we see art.",
    image:
      "https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=900&q=85",
    color: "purple",
  },
  {
    number: "03",
    category: "SCIENCE & DISCOVERY",
    title: "Future Relics",
    description: "Journey through human innovation, science and imagination.",
    image:
      "https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=900&q=85",
    color: "blue",
  },
];

const answers = {
  hours:
    "Our demo museum is open Tuesday to Sunday, from 10:00 AM to 6:00 PM. We are closed on Mondays.",
  price:
    "Our sample ticket prices are ₹200 for adults and ₹100 for children. Children under 5 enter free.",
  location:
    "MuseBot Museum is a fictional museum created for this project. Replace this with your chosen museum's address.",
  exhibitions:
    "Our featured exhibitions are Echoes of Egypt, Beyond the Canvas, and Future Relics. Scroll down the page to explore them.",
};

function getAnswer(message) {
  const text = message.toLowerCase();
  if (
  /near me|nearby|near my location|places around me|places near me|nearby places|nearby attractions/.test(
    text
  )
) {
  return 'To discover museums and attractions near you, open the "Nearby Places" section and select "Find Places Near Me". Allow location access when your browser asks.';
}

  if (/book|booking|reserve|reservation/.test(text)) {
    return "Let's book your museum visit! I'll guide you through the date, tickets and confirmation below.";
  }

  if (/hour|open|time|timing/.test(text)) return answers.hours;
  if (/price|cost|ticket|fee/.test(text)) return answers.price;
  if (/where|address|location/.test(text)) return answers.location;

  if (/exhibition|gallery|display|art|museum/.test(text)) {
    return answers.exhibitions;
  }

  return "I'm here to help! Ask about ticket prices, opening hours, exhibitions, location, or booking tickets.";
}

function getTaggedPlaceImage(tags) {
  if (tags.image) {
    return tags.image.startsWith("//")
      ? `https:${tags.image}`
      : tags.image;
  }

  if (tags.wikimedia_commons?.startsWith("File:")) {
    const filename = tags.wikimedia_commons.slice("File:".length);
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=900`;
  }

  return null;
}

async function findPlaceImage(name) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: name,
    gsrnamespace: "6",
    gsrlimit: "1",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "900",
    format: "json",
    origin: "*",
  });

  try {
    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?${params.toString()}`
    );
    if (!response.ok) return null;

    const data = await response.json();
    return Object.values(data.query?.pages ?? [])[0]?.imageinfo?.[0]
      ?.thumburl ?? null;
  } catch {
    return null;
  }
}

function NearbyPlaceImage({ place }) {
  const [imageUnavailable, setImageUnavailable] = useState(false);

  return (
    <div className="nearby-place-image">
      {place.image && !imageUnavailable ? (
        <img
          src={place.image}
          alt={`Photo of ${place.name}`}
          loading="lazy"
          onError={() => setImageUnavailable(true)}
        />
      ) : (
        <div className="nearby-place-placeholder">
          <strong>✳</strong>
          <span>{place.imageLoading ? "FINDING PHOTO" : "PHOTO UNAVAILABLE"}</span>
        </div>
      )}
    </div>
  );
}

function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Hello, explorer! 👋 I'm MuseBot. Ask me about exhibitions, tickets, or museum timings.",
    },
  ]);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);

  const [bookingStep, setBookingStep] = useState(null);
  const [chatBooking, setChatBooking] = useState({
    date: "",
    adults: 1,
    children: 0,
  });
  const [chatBookingError, setChatBookingError] = useState("");
  const [confirmedChatBooking, setConfirmedChatBooking] = useState(null);

  const [visitDate, setVisitDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [booking, setBooking] = useState(null);
  const [bookingError, setBookingError] = useState("");

  const [localToday] = useState(() => {
    const today = new Date();
    return [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
  });

  const total = adults * 200 + children * 100;
  const chatTotal = chatBooking.adults * 200 + chatBooking.children * 100;

  function addBotMessage(text) {
    setMessages((previous) => [...previous, { sender: "bot", text }]);
  }

  function startChatBooking() {
    setChatBooking({ date: "", adults: 1, children: 0 });
    setChatBookingError("");
    setConfirmedChatBooking(null);
    setBookingStep("date");

    setMessages((previous) => [
      ...previous,
      { sender: "user", text: "I'd like to book museum tickets." },
      {
        sender: "bot",
        text: "Absolutely! Let's book your visit together. First, choose the date you'd like to visit.",
      },
    ]);
  }

  function sendMessage(text = message) {
    const question = text.trim();
    if (!question) return;

    setMessage("");

    if (/\b(book|booking|reserve|reservation)\b/i.test(question)) {
      startChatBooking();
      return;
    }

    setMessages((previous) => [
      ...previous,
      { sender: "user", text: question },
      { sender: "bot", text: getAnswer(question.toLowerCase()) },
    ]);
  }

  function updateChatBooking(field, value) {
    setChatBooking((previous) => ({ ...previous, [field]: value }));
    setChatBookingError("");
  }

  function continueChatBooking() {
    if (!chatBooking.date || chatBooking.date < localToday) {
      setChatBookingError("Please choose today or a future date.");
      return;
    }

    setBookingStep("tickets");

    setMessages((previous) => [
      ...previous,
      { sender: "user", text: `I'd like to visit on ${chatBooking.date}.` },
      {
        sender: "bot",
        text: "Great! How many adult and child tickets would you like?",
      },
    ]);
  }

  function reviewChatBooking() {
    if (chatBooking.adults + chatBooking.children < 1) {
      setChatBookingError("Please select at least one visitor.");
      return;
    }

    setBookingStep("review");

    setMessages((previous) => [
      ...previous,
      {
        sender: "user",
        text: `${chatBooking.adults} adult ticket(s) and ${chatBooking.children} child ticket(s).`,
      },
      {
        sender: "bot",
        text: "Here is your booking summary. Please check everything before confirming.",
      },
    ]);
  }

  function confirmChatBooking() {
    const reference =
      "MUSE" + Math.random().toString(36).slice(2, 8).toUpperCase();

    const newBooking = {
  reference,
  visitDate: chatBooking.date,
  adults: chatBooking.adults,
  children: chatBooking.children,
  total: chatTotal,
  placeName: selectedPlace?.name || "MuseBot Museum",
  placeLatitude: selectedPlace?.latitude ?? null,
  placeLongitude: selectedPlace?.longitude ?? null,
};

    setConfirmedChatBooking(newBooking);
    setBookingStep("confirmed");
    setChatBookingError("");

    try {
      localStorage.setItem("musebot-booking", JSON.stringify(newBooking));
    } catch {
      // Confirmation still works if browser storage is unavailable.
    }

    setMessages((previous) => [
      ...previous,
      { sender: "user", text: "Confirm my booking." },
      {
        sender: "bot",
        text: `Your demo booking is confirmed! Attraction: ${newBooking.placeName}. Reference: ${reference}. Visit date: ${newBooking.visitDate}. Visitors: ${newBooking.adults} adult(s), ${newBooking.children} child(ren). Total: ₹${newBooking.total}. No real ticket or payment has been issued.`,
      },
    ]);
  }

  function handleBooking(event) {
    event.preventDefault();
    setBookingError("");

    if (!visitDate || visitDate < localToday) {
      setBookingError("Please select today or a future visit date.");
      return;
    }

    if (adults + children < 1) {
      setBookingError("Please select at least one visitor.");
      return;
    }

    const newBooking = {
      reference: "MUSE" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      visitDate,
      adults,
      children,
      total,
    };

    setBooking(newBooking);

    try {
      localStorage.setItem("musebot-booking", JSON.stringify(newBooking));
    } catch {
      // Confirmation still works if browser storage is unavailable.
    }
  }

  async function findNearbyPlaces() {
  setPlacesLoading(true);
  setPlacesError("");
  setNearbyPlaces([]);

  if (!navigator.geolocation) {
    setPlacesError("Your browser does not support location access.");
    setPlacesLoading(false);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      try {
        let uniquePlaces = [];

        for (const radius of [20000, 50000, 100000]) {
          const query = `
            [out:json][timeout:25];
            (
              nwr(around:${radius},${latitude},${longitude})["tourism"~"museum|attraction|gallery"];
              nwr(around:${radius},${latitude},${longitude})["historic"~"monument|museum|castle"];
            );
            out center tags;
          `;
          const response = await fetch(
            "https://overpass-api.de/api/interpreter",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: "data=" + encodeURIComponent(query),
            }
          );

          if (!response.ok) {
            throw new Error("Unable to retrieve nearby places.");
          }

          const data = await response.json();
          const places = data.elements
            .filter((place) => place.tags && place.tags.name)
            .map((place) => {
              const placeLatitude = place.lat ?? place.center?.lat;
              const placeLongitude = place.lon ?? place.center?.lon;
              const image = getTaggedPlaceImage(place.tags);

              return {
                id: `${place.type}-${place.id}`,
                name: place.tags.name,
                category:
                  place.tags.tourism ||
                  place.tags.historic ||
                  "Place of interest",
                image,
                imageLoading: !image,
                latitude: placeLatitude,
                longitude: placeLongitude,
                distance: Math.hypot(
                  (placeLatitude - latitude) *
                    Math.PI / 180 *
                    6371000,
                  (placeLongitude - longitude) *
                    Math.PI / 180 *
                    6371000 *
                    Math.cos(latitude * Math.PI / 180)
                ),
              };
            })
            .filter(
              (place) =>
                place.latitude != null &&
                place.longitude != null
            );

          uniquePlaces = Array.from(
            new Map(places.map((place) => [place.id, place])).values()
          ).sort((first, second) => first.distance - second.distance);

          if (uniquePlaces.length >= 5) break;
        }

        const placesToShow = uniquePlaces.slice(0, 12);
        setNearbyPlaces(placesToShow);

        const placesWithImages = await Promise.all(
          placesToShow.map(async (place) => {
            if (place.image) return { ...place, imageLoading: false };

            return {
              ...place,
              image: await findPlaceImage(place.name),
              imageLoading: false,
            };
          })
        );
        setNearbyPlaces(placesWithImages);

        if (uniquePlaces.length === 0) {
          setPlacesError(
            "No nearby museums or attractions were found. Try again later."
          );
        }
      } catch {
        setPlacesError(
          "Could not load nearby places. Please check your internet connection and try again."
        );
      } finally {
        setPlacesLoading(false);
      }
    },
    () => {
      setPlacesError(
        "Location access was denied. Allow location access in your browser and try again."
      );
      setPlacesLoading(false);
    },
    {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 300000,
    }
  );
}
  function bookNearbyPlace(place) {
  setSelectedPlace(place);
  setChatOpen(true);

  setBookingStep(null);
  setChatBooking({
    date: "",
    adults: 1,
    children: 0,
  });
  setChatBookingError("");
  setConfirmedChatBooking(null);

  setMessages((previous) => [
    ...previous,
    {
      sender: "user",
      text: `I want to book tickets for ${place.name}.`,
    },
    {
      sender: "bot",
      text: `Great choice! You've selected ${place.name}. I can guide you through the demo booking process. Please choose your visit date to get started.`,
    },
  ]);

  setBookingStep("date");
}

  function openBooking() {
    document.getElementById("booking")?.scrollIntoView({
      behavior: "smooth",
    });
  }

  function downloadTicket(ticket) {
  const pdf = new jsPDF();

  const pageWidth = pdf.internal.pageSize.getWidth();

  // Dark background
  pdf.setFillColor(15, 20, 38);
  pdf.rect(0, 0, pageWidth, 297, "F");

  // Brand header
  pdf.setTextColor(190, 176, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("M U S E B O T", 20, 22);

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(25);
  pdf.text("MUSEUM", 20, 48);
  pdf.text("ADMISSION TICKET", 20, 60);

  pdf.setDrawColor(120, 105, 225);
  pdf.setLineWidth(0.7);
  pdf.line(20, 70, pageWidth - 20, 70);

  // Booking reference
  pdf.setTextColor(173, 163, 255);
  pdf.setFontSize(10);
  pdf.text("BOOKING REFERENCE", 20, 84);

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(19);
  pdf.text(ticket.reference || "MUSE-DEMO", 20, 96);

  // Visit information
  pdf.setFontSize(10);
  pdf.setTextColor(180, 188, 210);
  pdf.text("VISIT DATE", 20, 117);
  pdf.text("ADULT TICKETS", 20, 140);
  pdf.text("CHILD TICKETS", 20, 158);

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.text(String(ticket.visitDate || "Not specified"), 20, 126);
  pdf.text(String(ticket.adults ?? 0), 20, 149);
  pdf.text(String(ticket.children ?? 0), 20, 167);
  pdf.setTextColor(180, 188, 210);
pdf.setFontSize(10);
pdf.text("SELECTED ATTRACTION", 20, 177);

pdf.setTextColor(255, 255, 255);
pdf.setFontSize(12);

const attractionName = pdf.splitTextToSize(
  ticket.placeName || "MuseBot Museum",
  pageWidth - 40
);

pdf.text(attractionName, 20, 185);

  // Ticket price breakdown
  pdf.setDrawColor(65, 72, 105);
  pdf.line(20, 180, pageWidth - 20, 180);

  pdf.setTextColor(180, 188, 210);
  pdf.setFontSize(10);
  pdf.text("Adult tickets: Rs. 200 each", 20, 193);
  pdf.text("Child tickets: Rs. 100 each", 20, 204);

  // Total
  pdf.setTextColor(190, 176, 255);
  pdf.setFontSize(12);
  pdf.text("TOTAL AMOUNT", 20, 225);

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(25);
  pdf.text(
    `Rs. ${Number(ticket.total ?? 0).toLocaleString("en-IN")}`,
    20,
    239
  );

  // Demo notice
  pdf.setDrawColor(120, 105, 225);
  pdf.roundedRect(20, 251, pageWidth - 40, 22, 3, 3, "S");

  pdf.setTextColor(205, 199, 255);
  pdf.setFontSize(9);
  pdf.text("MUSEBOT DIGITAL MUSEUM EXPERIENCE", pageWidth / 2, 260, {
    align: "center",
  });

  pdf.setTextColor(180, 188, 210);
  pdf.setFontSize(8);
  pdf.text("DEMO TICKET - NOT VALID FOR REAL MUSEUM ENTRY", pageWidth / 2, 267, {
    align: "center",
  });

  pdf.setTextColor(140, 150, 175);
  pdf.setFontSize(9);
  pdf.text("Thank you for planning your visit with MuseBot!", pageWidth / 2, 285, {
    align: "center",
  });

  // Download the PDF
  pdf.save("MuseBot-Ticket-" + (ticket.reference || "Demo") + ".pdf");
  }

  return (
    <div className="app-shell">
      <style>{`
        /* Responsive MuseBot chatbot and guided booking panel */
        .chat-window {
          width: min(410px, calc(100vw - 32px));
          height: min(690px, calc(100dvh - 120px));
          min-height: 400px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .chat-messages {
          flex: 1 1 auto;
          min-height: 80px;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-width: thin;
          scrollbar-color: #3b4260 transparent;
          scroll-behavior: smooth;
        }

        .chat-booking-panel {
          flex-shrink: 0;
          max-height: 48%;
          overflow-y: auto;
          padding: 15px;
          border-top: 1px solid #303650;
          background: radial-gradient(ellipse at top left, #25234a55, transparent 70%), #101522;
          scrollbar-width: thin;
          scrollbar-color: #414668 transparent;
        }

        .flow-step {
          margin-bottom: 12px;
          color: #a8a4ff;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.4px;
        }

        .chat-booking-panel > label {
          display: block;
          margin-bottom: 11px;
          color: #edf0ff;
          font-size: 12px;
          font-weight: 600;
        }

        .chat-booking-panel > input[type="date"] {
          box-sizing: border-box;
          width: 100%;
          min-height: 43px;
          padding: 0 11px;
          border: 1px solid #373e57;
          border-radius: 9px;
          outline: none;
          background: #0b101c;
          color: #eef2ff;
          color-scheme: dark;
          font-size: 12px;
        }

        .chat-booking-panel > input[type="date"]:focus {
          border-color: #9288ff;
        }

        .chat-flow-primary,
        .chat-flow-secondary {
          box-sizing: border-box;
          width: 100%;
          min-height: 42px;
          margin-top: 12px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
          transition: background .2s, border-color .2s;
        }

        .chat-flow-primary {
          border: 1px solid #8275f1;
          background: linear-gradient(110deg, #6254cb, #8171e9);
          color: white;
        }

        .chat-flow-primary:hover {
          background: linear-gradient(110deg, #7668e7, #9384f7);
        }

        .chat-flow-secondary {
          min-height: 35px;
          margin-top: 5px;
          border: 1px solid #30374c;
          background: transparent;
          color: #b7bfd4;
        }

        .chat-flow-secondary:hover {
          border-color: #7069b9;
          background: #1b2032;
        }

        .chat-flow-date {
          margin: 0 0 10px;
          color: #a6afc5;
          font-size: 11px;
        }

        .chat-flow-date strong {
          color: #eef2ff;
        }

        .chat-ticket-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 13px 0;
          border-top: 1px solid #2a3043;
        }

        .chat-ticket-row > div:first-child strong,
        .chat-ticket-row > div:first-child span {
          display: block;
        }

        .chat-ticket-row > div:first-child strong {
          color: #f0f2ff;
          font-size: 12px;
        }

        .chat-ticket-row > div:first-child span {
          margin-top: 5px;
          color: #929bb3;
          font-size: 10px;
        }

        .chat-quantity {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .chat-quantity button {
          width: 30px;
          height: 30px;
          border: 1px solid #424864;
          border-radius: 8px;
          background: #1a2031;
          color: #dedaff;
          cursor: pointer;
          font-size: 17px;
        }

        .chat-quantity button:hover {
          border-color: #8981ed;
          background: #292649;
        }

        .chat-quantity strong {
          min-width: 12px;
          color: #f4f5ff;
          text-align: center;
          font-size: 12px;
        }

        .chat-flow-total {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 5px;
          padding: 14px 0 3px;
          border-top: 1px solid #353b52;
        }

        .chat-flow-total span {
          color: #b1bad0;
          font-size: 11px;
        }

        .chat-flow-total strong {
          color: #d1caff;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 22px;
        }

        .chat-review-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 0;
          border-bottom: 1px solid #292f43;
        }

        .chat-review-row span {
          color: #a2abc1;
          font-size: 11px;
        }

        .chat-review-row strong {
          color: #f1f2ff;
          font-size: 11px;
          text-align: right;
          overflow-wrap: anywhere;
        }

        .chat-review-total strong {
          color: #c4bcff;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 19px;
        }

        .chat-booking-panel h4 {
          margin: 0 0 13px;
          color: #f2f3ff;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 17px;
        }

        .chat-error {
          margin: 9px 0 0;
          color: #ff9cae;
          font-size: 11px;
          line-height: 1.5;
        }

        .confirmation-chat-icon {
          width: 38px;
          height: 38px;
          margin-bottom: 12px;
          display: grid;
          place-items: center;
          border: 1px solid #34745d;
          border-radius: 12px;
          background: #15392f;
          color: #83e7bd;
          font-size: 21px;
        }

        .chat-confirmation-ref {
          padding: 12px;
          border: 1px solid #343957;
          border-radius: 9px;
          background: #171b30;
          color: #aeb7ce;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .chat-confirmation-ref strong {
          color: #d1caff;
        }

        .chat-confirmation-note {
          color: #9da6bb;
          font-size: 10px;
          line-height: 1.7;
        }

        .chat-input-area,
        .chat-disclaimer {
          flex-shrink: 0;
          background: #0c111e;
        }

        .quick-replies {
          flex-shrink: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .chat-launcher {
          z-index: 1001;
        }

        .chat-window {
          z-index: 1000;
        }

        @media (max-width: 620px) {
          .chat-window {
            position: fixed;
            inset: 8px;
            width: auto;
            height: auto;
            min-height: 0;
            max-height: none;
            border-radius: 17px;
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }

          .chat-header {
            min-height: 70px;
            flex-shrink: 0;
          }

          .chat-messages {
            flex: 1 1 0;
            min-height: 80px;
            padding: 15px 12px;
          }

          .chat-booking-panel {
            max-height: 52%;
            padding: 13px;
          }

          .chat-ticket-row {
            padding: 10px 0;
          }

          .chat-quantity {
            gap: 10px;
          }

          .chat-quantity button {
            width: 32px;
            height: 32px;
          }

          .quick-replies {
            max-height: 100px;
            overflow-y: auto;
          }

          .chat-input-area {
            flex-shrink: 0;
          }

          .chat-disclaimer {
            padding-bottom: 10px;
          }
        }

        .nearby-places-grid {
  margin-top: 28px;
}

.nearby-place-image {
  height: 205px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(
      circle at 25% 25%,
      #7868d855,
      transparent 42%
    ),
    linear-gradient(135deg, #1b2440, #111522 70%);
}

.nearby-place-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s;
}

.nearby-places-grid .exhibition-card:hover .nearby-place-image img {
  transform: scale(1.045);
}

.nearby-place-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 22px;
  color: #c8c0ff;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 2px;
  font-size: 10px;
}

.nearby-place-placeholder strong {
  font-family: "Space Grotesk", sans-serif;
  font-size: 42px;
  color: #f3f1ff;
  opacity: 0.9;
}

.nearby-places-note {
  margin-top: 18px;
  color: #a2abc1;
  font-size: 13px;
  line-height: 1.7;
}

.nearby-places-grid .text-link {
  text-decoration: none;
}

button:disabled {
  opacity: 0.65;
  cursor: wait;
}

        @media (max-width: 360px) {
          .chat-booking-panel {
            padding: 10px;
          }

          .chat-quantity {
            gap: 7px;
          }

          .chat-ticket-row > div:first-child span {
            font-size: 9px;
          }

          .quick-replies button {
            font-size: 8px;
            padding: 7px;
          }
        }
      `}</style>

      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="navbar">
        <a className="brand" href="#home" aria-label="MuseBot home">
          <div className="chat-date">
  YOUR DIGITAL MUSEUM GUIDE
  {selectedPlace && (
    <div style={{ marginTop: "10px", color: "#c8c0ff" }}>
      Selected place: <strong>{selectedPlace.name}</strong>
    </div>
  )}
</div>
        </a>

        <nav className="nav-links">
          <a href="#home">Home</a>
          <a href="#exhibitions">Exhibitions</a>
          <a href="#nearby-places">Nearby Places</a>
          <a href="#about">About</a>
        </nav>

        <button className="button button-primary nav-book" onClick={openBooking}>
          Book Tickets <span>↗</span>
        </button>
      </header>

      <main>
        <section className="hero section-wrap" id="home">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-dot" />
              CULTURE, REIMAGINED
            </div>

            <h1>
              History has a
              <br />
              <span className="gradient-text">new interface.</span>
            </h1>

            <p className="hero-description">
              Step into extraordinary stories. Explore timeless collections.
              Your next discovery is only a conversation away.
            </p>

            <div className="hero-actions">
              <button className="button button-primary" onClick={openBooking}>
                Explore &amp; Book <span>→</span>
              </button>
              <button
                className="button button-secondary"
                onClick={() => setChatOpen(true)}
              >
                <span className="sparkle">✳</span> Talk to MuseBot
              </button>
            </div>

            <div className="hero-stats">
              <div>
                <strong>03</strong>
                <span>Featured exhibitions</span>
              </div>
              <div className="stat-divider" />
              <div>
                <strong>∞</strong>
                <span>Stories to discover</span>
              </div>
              <div className="stat-divider" />
              <div>
                <strong>24/7</strong>
                <span>Digital assistance</span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="visual-glow" />
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="hero-image-frame">
              <img
                src="https://images.unsplash.com/photo-1564399579883-451a5d44ec08?auto=format&fit=crop&w=1000&q=85"
                alt="Sculpture displayed inside a museum"
              />
              <div className="image-overlay" />
              <div className="image-label">
                <span className="label-icon">✳</span>
                <div>
                  <strong>Discover the extraordinary</strong>
                  <span>EVERY OBJECT TELLS A STORY</span>
                </div>
              </div>
            </div>

            <div className="floating-card">
              <span className="floating-icon">✧</span>
              <div>
                <strong>Your journey starts here</strong>
                <span>Ask MuseBot anything</span>
              </div>
              <span className="online-dot" />
            </div>

            <div className="hero-index">MB / 001 — DISCOVERY</div>
          </div>
        </section>

        <section className="trust-strip">
          <div className="section-wrap trust-inner">
            <span>CURATED FOR THE CURIOUS</span>
            <span>✳ ART &amp; CULTURE</span>
            <span>◈ HUMAN HISTORY</span>
            <span>⌘ SCIENCE &amp; IDEAS</span>
          </div>
        </section>

        <section className="exhibitions section-wrap" id="exhibitions">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                <span className="status-dot" /> YOUR NEXT DISCOVERY
              </div>
              <h2>
                Worlds worth <span>exploring.</span>
              </h2>
              <p>
                Three windows into extraordinary worlds. Where will you begin?
              </p>
            </div>
            <span className="section-count">COLLECTION / 001—003</span>
          </div>

          <div className="exhibition-grid">
            {exhibitions.map((item) => (
              <article className="exhibition-card" key={item.number}>
                <div className="exhibition-image">
                  <img src={item.image} alt={item.title} loading="lazy" />
                  <span className={`image-number ${item.color}`}>
                    {item.number}
                  </span>
                  <span className="image-arrow">↗</span>
                </div>

                <div className="exhibition-info">
                  <span className="card-category">{item.category}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <button className="text-link" onClick={openBooking}>
                    Plan your visit <span>→</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
  className="exhibitions section-wrap"
  id="nearby-places"
>
  <div className="section-heading">
    <div>
      <div className="eyebrow">
        <span className="status-dot" />
        DISCOVER AROUND YOU
      </div>

      <h2>
        Places near <span>you.</span>
      </h2>

      <p>
        Find museums, galleries, historic monuments and attractions
        near your current location. The search expands its range to find
        at least five places when more are available.
      </p>
    </div>

    <span className="section-count">
      LOCAL DISCOVERY
    </span>
  </div>

  <button
    className="button button-primary"
    onClick={findNearbyPlaces}
    disabled={placesLoading}
  >
    {placesLoading
      ? "Finding places..."
      : "Find Places Near Me"}
    {!placesLoading && <span> →</span>}
  </button>

  {placesError && (
    <p className="error-message" role="status">
      {placesError}
    </p>
  )}

  {nearbyPlaces.length > 0 && (
    <div className="exhibition-grid nearby-places-grid">
      {nearbyPlaces.map((place) => (
        <article
          className="exhibition-card"
          key={place.id}
        >
          <NearbyPlaceImage place={place} />

          <div className="exhibition-info">
            <span className="card-category">
              {place.category.replace(/_/g, " ")}
            </span>

            <h3>{place.name}</h3>

            <p>
              A nearby place you can explore during your visit.
            </p>

           <a
  className="text-link"
  href={`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`}
  target="_blank"
  rel="noopener noreferrer"
>
  Get directions <span>↗</span>
</a>

<button
  className="button button-primary full-button"
  style={{ marginTop: "16px" }}
  onClick={() => bookNearbyPlace(place)}
>
  Book Through MuseBot <span>→</span>
</button>
            
          </div>
        </article>
      ))}
    </div>
  )}

  {!placesLoading &&
    nearbyPlaces.length === 0 &&
    !placesError && (
      <p className="nearby-places-note">
        Select the button above to discover places near your
        current location. Your browser will ask for permission
        to access your location.
      </p>
    )}
</section>

        <section className="booking-section section-wrap" id="booking">
          <div className="booking-intro" id="about">
            <div className="eyebrow">
              <span className="status-dot" /> YOUR EXPERIENCE, SIMPLIFIED
            </div>
            <h2>
              Less waiting.
              <br />
              <span className="gradient-text">More wondering.</span>
            </h2>
            <p>
              Plan your visit in seconds. Choose your date, select your tickets,
              and get ready to explore. No complicated steps.
            </p>
            <div className="feature-line">
              <span>✓</span> Simple ticket selection
            </div>
            <div className="feature-line">
              <span>✓</span> Instant demo confirmation
            </div>
            <div className="feature-line">
              <span>✓</span> Helpful chatbot assistance
            </div>
          </div>

          <div className="booking-card">
            {booking ? (
              <div className="confirmation">
                <div className="success-icon">✓</div>
                <div className="eyebrow">DEMO BOOKING CREATED</div>
                <h3>You're on the list.</h3>
                <p>Your sample booking details are ready.</p>

                <div className="confirmation-details">
                  <div>
                    <span>REFERENCE</span>
                    <strong>{booking.reference}</strong>
                  </div>
                  <div>
                    <span>VISIT DATE</span>
                    <strong>{booking.visitDate}</strong>
                  </div>
                  <div>
                    <span>VISITORS</span>
                    <strong>
                      {booking.adults} adult(s), {booking.children} child(ren)
                    </strong>
                  </div>
                  <div>
                    <span>DEMO TOTAL</span>
                    <strong>₹{booking.total}</strong>
                  </div>
                </div>

                <p className="demo-notice">
                  This is a frontend demo. No real ticket or payment has been
                  issued.
                </p>

                <button
                  className="button button-primary full-button"
                  onClick={() => downloadTicket(booking)}
                >
                  Download Ticket PDF ↓
                </button>

                <button
                  className="button button-primary full-button"
                  onClick={() => setBooking(null)}
                >
                  Make another booking
                </button>
              </div>
            ) : (
              <>
                <div className="booking-card-heading">
                  <span className="booking-icon">▦</span>
                  <div>
                    <h3>Plan your visit</h3>
                    <p>YOUR DISCOVERY STARTS HERE</p>
                  </div>
                </div>

                <form onSubmit={handleBooking}>
                  <label className="field-label" htmlFor="visit-date">
                    VISIT DATE
                  </label>
                  <input
                    id="visit-date"
                    className="date-input"
                    type="date"
                    min={localToday}
                    value={visitDate}
                    onChange={(event) => setVisitDate(event.target.value)}
                    required
                  />

                  <div className="ticket-row">
                    <div>
                      <strong>Adult</strong>
                      <span>Age 13 and above</span>
                    </div>
                    <strong className="ticket-price">₹200</strong>
                    <div className="quantity-control">
                      <button
                        type="button"
                        aria-label="Remove adult"
                        onClick={() => setAdults(Math.max(0, adults - 1))}
                      >
                        −
                      </button>
                      <span>{adults}</span>
                      <button
                        type="button"
                        aria-label="Add adult"
                        onClick={() => setAdults(adults + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="ticket-row">
                    <div>
                      <strong>Child</strong>
                      <span>Age 5–12</span>
                    </div>
                    <strong className="ticket-price">₹100</strong>
                    <div className="quantity-control">
                      <button
                        type="button"
                        aria-label="Remove child"
                        onClick={() => setChildren(Math.max(0, children - 1))}
                      >
                        −
                      </button>
                      <span>{children}</span>
                      <button
                        type="button"
                        aria-label="Add child"
                        onClick={() => setChildren(children + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="total-row">
                    <span>Estimated total</span>
                    <strong>₹{total.toLocaleString("en-IN")}</strong>
                  </div>

                  {bookingError && (
                    <p className="error-message">{bookingError}</p>
                  )}

                  <button
                    type="submit"
                    className="button button-primary full-button"
                  >
                    Confirm demo booking <span>→</span>
                  </button>
                  <p className="form-note">Demo only · No payment required</p>
                </form>
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="section-wrap footer-inner">
          <a className="brand" href="#home">
            <span className="brand-mark">M</span>
            <span>
              MUSE<span className="brand-light">BOT</span>
              <small>DIGITAL MUSEUM EXPERIENCE</small>
            </span>
          </a>
          <p>Built for the curious. Designed for discovery.</p>
          <span className="footer-tag">FRONTEND PROJECT · 2026</span>
        </div>
      </footer>

      <button
        className={`chat-launcher ${chatOpen ? "launcher-active" : ""}`}
        onClick={() => setChatOpen(!chatOpen)}
        aria-label={chatOpen ? "Close MuseBot chat" : "Open MuseBot chat"}
      >
        {chatOpen ? "×" : "✳"}
        {!chatOpen && <span className="launcher-dot" />}
      </button>

      {chatOpen && (
        <section className="chat-window" aria-label="MuseBot chatbot">
          <div className="chat-header">
            <div className="chat-avatar">M</div>
            <div className="chat-title">
              <strong>MuseBot Assistant</strong>
              <span>
                <span className="online-dot" /> Online · Ready to help
              </span>
            </div>
            <button
              className="chat-close"
              onClick={() => setChatOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          <div className="chat-messages" aria-live="polite">
            <div className="chat-date">YOUR DIGITAL MUSEUM GUIDE</div>
            {messages.map((item, index) => (
              <div
                className={`message-row ${item.sender}`}
                key={`${index}-${item.sender}`}
              >
                {item.sender === "bot" && (
                  <span className="message-avatar">M</span>
                )}
                <div className="message-bubble">{item.text}</div>
              </div>
            ))}
          </div>

          {bookingStep && bookingStep !== "confirmed" && (
            <div className="chat-booking-panel">
              {bookingStep === "date" && (
                <>
                  <div className="flow-step">STEP 1 OF 3 · VISIT DATE</div>
                  <label htmlFor="chat-visit-date">
                    When would you like to visit?
                  </label>
                  <input
                    id="chat-visit-date"
                    type="date"
                    min={localToday}
                    value={chatBooking.date}
                    onChange={(event) =>
                      updateChatBooking("date", event.target.value)
                    }
                  />
                  {chatBookingError && (
                    <p className="chat-error">{chatBookingError}</p>
                  )}
                  <button
                    className="chat-flow-primary"
                    onClick={continueChatBooking}
                  >
                    Continue to tickets →
                  </button>
                </>
              )}

              {bookingStep === "tickets" && (
                <>
                  <div className="flow-step">STEP 2 OF 3 · VISITORS</div>
                  <p className="chat-flow-date">
                    Visit date: <strong>{chatBooking.date}</strong>
                  </p>

                  <div className="chat-ticket-row">
                    <div>
                      <strong>Adults</strong>
                      <span>₹200 per ticket</span>
                    </div>
                    <div className="chat-quantity">
                      <button
                        aria-label="Remove adult ticket"
                        onClick={() =>
                          updateChatBooking(
                            "adults",
                            Math.max(0, chatBooking.adults - 1)
                          )
                        }
                      >
                        −
                      </button>
                      <strong>{chatBooking.adults}</strong>
                      <button
                        aria-label="Add adult ticket"
                        onClick={() =>
                          updateChatBooking("adults", chatBooking.adults + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="chat-ticket-row">
                    <div>
                      <strong>Children</strong>
                      <span>₹100 per ticket</span>
                    </div>
                    <div className="chat-quantity">
                      <button
                        aria-label="Remove child ticket"
                        onClick={() =>
                          updateChatBooking(
                            "children",
                            Math.max(0, chatBooking.children - 1)
                          )
                        }
                      >
                        −
                      </button>
                      <strong>{chatBooking.children}</strong>
                      <button
                        aria-label="Add child ticket"
                        onClick={() =>
                          updateChatBooking(
                            "children",
                            chatBooking.children + 1
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="chat-flow-total">
                    <span>Estimated total</span>
                    <strong>₹{chatTotal.toLocaleString("en-IN")}</strong>
                  </div>

                  {chatBookingError && (
                    <p className="chat-error">{chatBookingError}</p>
                  )}

                  <button
                    className="chat-flow-primary"
                    onClick={reviewChatBooking}
                  >
                    Review booking →
                  </button>
                  <button
                    className="chat-flow-secondary"
                    onClick={() => {
                      setBookingStep("date");
                      setChatBookingError("");
                    }}
                  >
                    ← Change date
                  </button>
                </>
              )}

              {bookingStep === "review" && (
                <>
                  <div className="flow-step">STEP 3 OF 3 · REVIEW</div>
                  <h4>Confirm your visit</h4>

                  <div className="chat-review-row">
                    <span>Visit date</span>
                    <strong>{chatBooking.date}</strong>
                  </div>
                  <div className="chat-review-row">
                    <span>Adult tickets</span>
                    <strong>{chatBooking.adults}</strong>
                  </div>
                  <div className="chat-review-row">
                    <span>Child tickets</span>
                    <strong>{chatBooking.children}</strong>
                  </div>
                  <div className="chat-review-row chat-review-total">
                    <span>Total</span>
                    <strong>₹{chatTotal.toLocaleString("en-IN")}</strong>
                  </div>

                  {chatBookingError && (
                    <p className="chat-error">{chatBookingError}</p>
                  )}

                  <button
                    className="chat-flow-primary"
                    onClick={confirmChatBooking}
                  >
                    Confirm my booking ✓
                  </button>
                  <button
                    className="chat-flow-secondary"
                    onClick={() => {
                      setBookingStep("tickets");
                      setChatBookingError("");
                    }}
                  >
                    ← Edit visitors
                  </button>
                </>
              )}
            </div>
          )}

          {!bookingStep && (
            <div className="quick-replies">
              <button onClick={() => sendMessage("Ticket prices")}>
                Ticket prices
              </button>
              <button onClick={() => sendMessage("Opening hours")}>
                Opening hours
              </button>
              <button onClick={() => sendMessage("Exhibitions")}>
                Exhibitions
              </button>
              <button onClick={startChatBooking}>🎟 Book tickets</button>
            </div>
          )}

          {bookingStep === "confirmed" && (
            <div className="chat-booking-panel">
              <div className="confirmation-chat-icon">✓</div>
              <div className="flow-step">BOOKING COMPLETE</div>
              <h4>Your visit is planned!</h4>
              <p className="chat-confirmation-ref">
                Reference:{" "}
                <strong>{confirmedChatBooking?.reference}</strong>
              </p>
              <p className="chat-confirmation-note">
                This is a demo confirmation, not a real museum ticket.
              </p>

              <button
                className="chat-flow-primary"
                onClick={() => downloadTicket(confirmedChatBooking)}
              >
                Download Ticket PDF ↓
              </button>

              <button
                className="chat-flow-primary"
                onClick={startChatBooking}
              >
                Book another visit →
              </button>
              <button
                className="chat-flow-secondary"
                onClick={() => {
                  setBookingStep(null);
                  addBotMessage(
                    "You're welcome! Ask me if you need help with anything else."
                  );
                }}
              >
                Back to chat
              </button>
            </div>
          )}

          <form
            className="chat-input-area"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <input
              aria-label="Type your message"
              placeholder="Ask me anything..."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <button type="submit" aria-label="Send message" disabled={!message.trim()}>
              ↑
            </button>
          </form>

          <div className="chat-disclaimer">
            MUSEBOT · YOUR GUIDE TO DISCOVERY
          </div>
        </section>
      )}
    </div>
  );
}

export default App;
