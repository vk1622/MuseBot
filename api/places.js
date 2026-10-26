export const config = {
  maxDuration: 20,
};

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const latitude = Number(request.query.lat);
  const longitude = Number(request.query.lon);

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return response.status(400).json({ error: "Invalid location coordinates." });
  }

  const query = `
    [out:json][timeout:15];
    (
      nwr(around:100000,${latitude},${longitude})["tourism"~"museum|attraction|gallery"];
      nwr(around:100000,${latitude},${longitude})["historic"~"monument|museum|castle"];
    );
    out center tags;
  `;

  try {
    const upstream = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(18000),
    });

    if (!upstream.ok) {
      console.error("Overpass API returned status", upstream.status);
      return response
        .status(502)
        .json({ error: "The places service is temporarily unavailable. Please try again." });
    }

    const data = await upstream.json();
    return response.status(200).json({ elements: data.elements ?? [] });
  } catch (error) {
    console.error("Nearby places request failed:", error);
    return response
      .status(502)
      .json({ error: "Could not reach the places service. Please try again shortly." });
  }
}
