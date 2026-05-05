/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import z from "zod";

const WIDGET_URI = "ui://flashcards-widget";

export default {
	async fetch(request, env, ctx): Promise<Response> {

		const server = new McpServer({
			name: "Flashcard Server",
			version: "1.0",
		});

		registerAppResource(server, "Flashcard Widget", WIDGET_URI, {description: "Flashcard Widget"},
			async () => {
				const html = await env.ASSETS.fetch(new URL("http://your-aledmana-worker.com/index.html"))
				return {
					contents: [
						{
							uri: WIDGET_URI,
							text: await html.text(),
							mimeType: RESOURCE_MIME_TYPE,
							_meta: {
								ui: {
									csp: {
										connectDomains: ['https://*.workers.dev'],
										resourceDomains: [
											'https://*.workers.dev',
											'https://fonts.googleapis.com',
											'https://fonts.gstatic.com',
											'https://image.tmdb.org',
										],
									},
								},
							},
						}
					]
				}
			}
		);

		// create deck
		registerAppTool(server, "create-deck", {
			title: "Create Deck",
			description: "이 툴을 사용해서 공부용 플래시카드를 만들어줘. 20개의 카드를 생성하는데, 카드 앞면에는 질문을 넣고, 뒷면에는 정답을 넣고, 카드에 힌트로 추가해서 만들어줘. 이 툴을 사용하기 전에 유저에게 username을 물어봐.",
			inputSchema: {
				username: z.string().describe("사용자의 username이야. 이 툴을 사용하기 전에 이걸 요청해."),
				title: z.string().describe("카드뭉치의 테이틀이야. 예를들어, 'React Fundamentals'"),
				description: z.string().describe("여기에는 카드뭉치의 내용에 대한 간단한 설명이 들어가."),
				cards: z.array(
					z.object({
						front: z.string().describe("질문이나 프롬프트를 설명하는 내용"),
						back: z.string().describe("정답 단어가 적혀있지."),
						hint: z.string().describe("그 카드를 위한 힌트가 적혀있지.")
					}),
				).min(10).max(20).describe("플래시카드의 배열 (20개를 목표로 카드를 생성해 줘.)")
			},
			annotations: {
				readOnlyHint: false,
			},
			_meta: {
				ui: {
					resourceUri: WIDGET_URI,
				}
			}
		}, async ({title, description, cards, username}) => {
			const cardsWithIds = cards.map((card, index) => ({
				id: `card-${Date.now()}-${index}`,
				status: 'new',
				...card,
			}));
			const deck = {
				id: `deck-${Date.now()}`,
				title,
				description,
				cards: cardsWithIds,
				createdAt: new Date().toISOString(),
			};

			const deckskey = `user:${username}:decks`;

			await env.FLASHCARDS_KV.put(`user:${username}:deck:${deck.id}`, JSON.stringify(deck))

			const existingDecks = await env.FLASHCARDS_KV.get<string[]>(deckskey, "json");

			const deckIds = existingDecks || [];

			deckIds.push(deck.id);

			await env.FLASHCARDS_KV.put(deckskey, JSON.stringify(deckIds));

			// `user:aledmana:decks` -> ['deck_1', 'deck_2', 'deck_3']
			
			return {
				content: [
					{
						type: "text",
						text: `Created a ${title} deck with ${cards.length} flashcards`,
					}
				],
				structuredContent: { deck, username },
			}
		});

		// list decks

		// open deck

		// mark card (private)

		// reset deck (private)

		// delete deck

		const handler = createMcpHandler(server);

		return handler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
