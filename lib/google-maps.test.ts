import { describe, expect, it } from "vitest";
import { extractGoogleMapsUrl, parseCoordinatesFromGoogleMapsUrl } from "./google-maps";

describe("Google Maps URL parsing", () => {
  it("extracts a short Google Maps link from pasted Arabic ad text", () => {
    const text = "الموقع: https://maps.app.goo.gl/oK4ERAuEARgHsK1y6?g_st=ipc";
    expect(extractGoogleMapsUrl(text)).toBe("https://maps.app.goo.gl/oK4ERAuEARgHsK1y6?g_st=ipc");
  });

  it("reads coordinates from Google Maps query redirects", () => {
    expect(parseCoordinatesFromGoogleMapsUrl("https://www.google.com/maps?q=24.7738817,46.6448979&entry=gps")).toEqual({
      lat: 24.7738817,
      lng: 46.6448979,
    });
  });
});
