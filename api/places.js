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
    [out:json][timeout:8];
    (
      nwr(around:20000,${latitude},${longitude})["tourism"~"museum|attraction|gallery"];
      nwr(around:20000,${latitude},${longitude})["historic"~"monument|museum|castle"];
    );
    out center tags;
  `;

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];
  const failures = [];

  for (const endpoint of endpoints) {
    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(5000),
      });

      if (!upstream.ok) {
        failures.push(`${new URL(endpoint).hostname}: HTTP ${upstream.status}`);
        continue;
      }

      const data = await upstream.json();
      return response.status(200).json({ elements: data.elements ?? [] });
    } catch (error) {
      failures.push(
        `${new URL(endpoint).hostname}: ${
          error instanceof Error ? error.message : "request failed"
        }`
      );
    }
  }

  console.error("All Overpass endpoints failed:", failures.join("; "));
  return response
    .status(502)
    .json({ error: "The places service is temporarily unavailable. Please try again." });
}
