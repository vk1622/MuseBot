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

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    console.error("GEOAPIFY_API_KEY is not configured.");
    return response
      .status(500)
      .json({ error: "Nearby places search is not configured yet." });
  }

  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set(
    "categories",
    "entertainment.museum,entertainment.culture.gallery,tourism.attraction,tourism.sights"
  );
  url.searchParams.set("filter", `circle:${longitude},${latitude},20000`);
  url.searchParams.set("bias", `proximity:${longitude},${latitude}`);
  url.searchParams.set("limit", "50");
  url.searchParams.set("lang", "en");

  try {
    const upstream = await fetch(url, {
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    const data = await upstream.json();

    if (!upstream.ok) {
      console.error("Geoapify Places API returned status", upstream.status);
      if (upstream.status === 401 || upstream.status === 403) {
        return response.status(502).json({
          error: "The places API key is invalid or not enabled. Check GEOAPIFY_API_KEY in Vercel.",
        });
      }
      if (upstream.status === 429) {
        return response.status(502).json({
          error: "The places search limit has been reached. Please try again later.",
        });
      }
      return response.status(502).json({
        error: "The places service is temporarily unavailable. Please try again.",
      });
    }

    const elements = (data.features ?? []).map((feature) => {
      const properties = feature.properties ?? {};
      const categories = properties.categories ?? [];
      const placeCategory =
        categories.find((category) => category.startsWith("entertainment.")) ??
        categories.find((category) => category.startsWith("tourism.")) ??
        "Place of interest";

      return {
        id: properties.place_id,
        type: "geoapify",
        lat: properties.lat ?? feature.geometry?.coordinates?.[1],
        lon: properties.lon ?? feature.geometry?.coordinates?.[0],
        tags: {
          name: properties.name,
          tourism: placeCategory,
        },
      };
    });

    return response.status(200).json({ elements });
  } catch (error) {
    console.error("Geoapify Places API request failed:", error);
    return response.status(502).json({
      error: "Could not reach the places service. Please try again shortly.",
    });
  }
}
