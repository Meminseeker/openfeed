// Offline public YouTube fixtures for the isolated API integration server.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.startsWith("https://www.tiktok.com/embed/@")) {
    const path = new URL(url).pathname;
    return new Response(
      `<script type="application/json">${JSON.stringify({
        source: {
          data: {
            [path]: {
              isReady: true,
              isError: false,
              userInfo: {
                uniqueId: path.slice("/embed/@".length),
                privateAccount: false,
              },
              videoList: [
                {
                  id: String(BigInt(Math.floor(Date.now() / 1000)) << 32n),
                  authorUniqueId: path.slice("/embed/@".length),
                  desc: "TikTok embed fixture",
                  privateItem: false,
                },
              ],
            },
          },
        },
      })}</script>`,
    );
  }
  if (url.startsWith("https://www.tiktok.com/"))
    return new Response("SlardarWAF");
  if (url.startsWith("https://www.instagram.com/"))
    return new Response(
      `<script type="application/json">${JSON.stringify({ data: { user: { username: new URL(url).pathname.split("/")[1], is_private: false, edge_owner_to_timeline_media: { edges: [{ node: { shortcode: "testAlbum", edge_media_to_caption: { edges: [{ node: { text: "Instagram test album" } }] }, edge_sidecar_to_children: { edges: [{ node: { display_url: "https://scontent.cdninstagram.com/one.jpg" } }, { node: { display_url: "https://scontent.cdninstagram.com/two.jpg" } }] } } }] } } } })}</script>`,
    );
  if (url.startsWith("https://syndication.twitter.com/"))
    return new Response(
      `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { timeline: { entries: [{ type: "tweet", content: { tweet: { id_str: "123", user: { screen_name: url.split("/").at(-1), protected: false }, full_text: "A public X post", created_at: new Date().toISOString() } } }] } } } })}</script>`,
    );
  if (!url.startsWith("https://www.youtube.com/"))
    return originalFetch(input, init);
  if (url.includes("/feeds/"))
    return new Response(
      "<feed><entry><yt:videoId>test-post</yt:videoId><title>Test video</title><published>" +
        new Date().toISOString() +
        "</published></entry></feed>",
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
