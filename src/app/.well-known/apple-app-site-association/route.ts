export function GET() {
  return Response.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: "A4MAJNXUQY.com.timestampcamerafree.gpsmapcameratimemark.geotagginglocationonphoto",
            paths: ["/share"],
          },
        ],
      },
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
