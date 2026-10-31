// Offline public YouTube fixtures for the isolated API integration server.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.startsWith("https://api.fxtwitter.com/"))
    return Response.json({
      code: 200,
      tweet: {
        id: new URL(url).pathname.split("/").at(-1),
        text: "Complete public post. ".repeat(30),
        created_timestamp: 1600000000,
        author: { screen_name: "test", name: "Test" },
      },
    });
  if (url.startsWith("https://www.youtube.com/oembed"))
    return Response.json({
      title: "A shared video",
      author_name: "Library author",
    });
  if (url.startsWith("https://www.youtube.com/playlist"))
    return new Response(
      "var ytInitialData = " +
        JSON.stringify({
          metadata: { playlistMetadataRenderer: { title: "Test playlist" } },
          contents: {
            playlistVideoRenderer: {
              videoId: "abcdefghijk",
              title: { simpleText: "Old first video" },
              isPlayable: true,
            },
            continuationItemRenderer: {
              continuationEndpoint: {
                continuationCommand: { token: "next-page" },
              },
            },
          },
        }) +
        ";",
    );
  if (url.startsWith("https://www.youtube.com/youtubei/v1/browse"))
    return Response.json({
      playlistVideoRenderer: {
        videoId: "lmnopqrstuv",
        title: { simpleText: "Second video" },
        isPlayable: true,
      },
    });
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
  if (url.startsWith("https://www.patreon.com/api/campaigns?"))
    return Response.json(
      {
        data: [
          {
            id: "6460488",
            type: "campaign",
            attributes: {
              vanity: new URL(url).searchParams.get("filter[vanity]"),
              name: "Patreon creator",
            },
          },
        ],
      },
      { headers: { "content-type": "application/vnd.api+json" } },
    );
  if (url.startsWith("https://www.patreon.com/api/posts")) {
    // Member content is visible only when the fixture session cookie is sent.
    const member =
      (init?.headers as Record<string, string> | undefined)?.Cookie ===
      "session_id=fixture-session";
    const post = {
      id: "900",
      type: "post",
      attributes: {
        title: "Member update",
        content_json_string: member
          ? JSON.stringify({
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Member text" }],
                },
              ],
            })
          : null,
        teaser_text_json_string: null,
        published_at: new Date().toISOString(),
        url: "https://www.patreon.com/posts/member-update-900",
        current_user_can_view: member,
        was_posted_by_campaign_owner: true,
      },
    };
    return Response.json(
      url.includes("/api/posts/900") ? { data: post } : { data: [post] },
      { headers: { "content-type": "application/vnd.api+json" } },
    );
  }
  if (/^https:\/\/x\.com\/test\/status\/123$/.test(url))
    return new Response(
      `<link rel="canonical" href="${url}"><h1>Test on X: &quot;${"Complete public post. ".repeat(30)}&quot;</h1>`,
    );
  if (url.startsWith("https://syndication.twitter.com/"))
    return new Response(
      `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { timeline: { entries: [{ type: "tweet", content: { tweet: { id_str: "123", user: { screen_name: url.split("/").at(-1), protected: false }, full_text: "A public X post preview. ".repeat(12), note_tweet: { id: "long-note" }, created_at: new Date().toISOString() } } }] } } } })}</script>`,
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
