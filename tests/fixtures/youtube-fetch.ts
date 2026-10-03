// Offline public YouTube fixtures for the isolated API integration server.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (!url.startsWith("https://www.youtube.com/"))
    return originalFetch(input, init);
  if (url.includes("/feeds/"))
    return new Response(
      "<feed><entry><yt:videoId>test-post</yt:videoId><title>Test video</title><published>2026-09-30T00:00:00Z</published></entry></feed>",
    );
  const content = url.endsWith("/videos")
    ? {
        videoRenderer: {
          videoId: "test-post",
          title: { simpleText: "Test video" },
        },
      }
    : url.endsWith("/shorts")
      ? {
          reelItemRenderer: {
            videoId: "test-short",
            headline: { simpleText: "Test short" },
          },
        }
      : url.endsWith("/posts")
        ? {
            backstagePostRenderer: {
              postId: "test-community",
              authorEndpoint: {
                browseEndpoint: { browseId: "UCLRYyGAoqR26MpjAmbrG6oQ" },
              },
              contentText: { simpleText: "Test album" },
              backstageAttachment: {
                postMultiImageRenderer: {
                  images: [
                    {
                      backstageImageRenderer: {
                        image: {
                          thumbnails: [
                            { url: "https://example.com/one.jpg", width: 800 },
                          ],
                        },
                      },
                    },
                    {
                      backstageImageRenderer: {
                        image: {
                          thumbnails: [
                            { url: "https://example.com/two.jpg", width: 800 },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          }
        : {
            channelMetadataRenderer: {
              externalId: "UCLRYyGAoqR26MpjAmbrG6oQ",
              title: "Test Creator",
            },
          };
  return new Response(
    `var ytInitialData = ${JSON.stringify({ tabs: [{ tabRenderer: { selected: true, content } }] })};`,
  );
};
