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

const cardSchema = z.object(
	{
		id: z.string().readonly(),
		front: z.string().describe("질문이나 프롬프트를 설명하는 내용"),
		back: z.string().describe("정답 단어가 적혀있지."),
		hint: z.string().describe("그 카드를 위한 힌트가 적혀있지."),
		status: z.enum(['new', 'learning', 'mastered']).readonly().default('new'),
	}
)

const deckSchema = z.object(
	{
		title: z.string().describe("카드뭉치의 테이틀이야. 예를들어, 'React Fundamentals'"),
		description: z.string().describe("여기에는 카드뭉치의 내용에 대한 간단한 설명이 들어가."),
		cards: z.array(
			cardSchema,
		).min(10).max(20).describe("플래시카드의 배열 (20개를 목표로 카드를 생성해 줘.)"),
	}
)

type Deck = z.infer<typeof deckSchema>;
type Card = z.infer<typeof cardSchema>;

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
				deck: deckSchema,
			},
			annotations: {
				readOnlyHint: false,
			},
			_meta: {
				ui: {
					resourceUri: WIDGET_URI,
				}
			}
		}, async ({deck:{title, description, cards}, username}) => {
			const cardsWithIds = cards.map((card, index) => ({
				...card,
				id: `card-${Date.now()}-${index}`,
				status: 'new',
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
		registerAppTool(server, "list-decks", {
			title: "List Decks",
			description: "사용자의 모든 카드뭉치를 보여주는 툴이다. 만약 아직 username을 받지 못했다면 이 툴을 사용하기 전에 사용자에게 username을 물어봐.",
			inputSchema: {
				username: z.string().describe("사용자의 username이야. 이 툴을 사용하기 전에 이걸 요청해."),
			},
			annotations: {
				readOnlyHint: true,
			},
			_meta: {
				ui: {
					resourceUri: WIDGET_URI,
				}
			}
		}, async ({username}) => {
			const deckskey = `user:${username}:decks`;

			const deckIds = await env.FLASHCARDS_KV.get<string[]>(deckskey, "json")

			if(!deckIds || deckIds.length === 0) {
				return {
					content: [{ text: "보유 중인 카드 뭉치가 없습니다.", type: "text" }],
					structuredContent: { decks: [] },
				}
			}

			const decks = []

			for (const deckId of deckIds) {
				const deck = await env.FLASHCARDS_KV.get<Deck>(`user:${username}:deck:${deckId}`, "json");
				if (deck) {
					const masteredCount = deck.cards.filter(card => card.status === "mastered").length;
					decks.push({ masteredCount, ...deck })
				}
			}
	
			return {
				content: [
					{
						type: "text",
						text: `총 ${decks.length}개의 ${JSON.stringify(decks)}를 찾았다.`,
					}
				],
				structuredContent: { decks, username },
			}
		});

		// open deck
		registerAppTool(server, "open-deck", {
			title: "Open Deck",
			description: "이 툴은 사용자가 공부할 카드 뭉치를 열어서 카드를 보여주는 툴이야. 만약 아직 username을 받지 못했다면 이 툴을 사용하기 전에 사용자에게 username을 물어봐. 공부할 카드 뭉치의 deck ID도 가지고 있어야 해.",
			inputSchema: {
				username: z.string().describe("사용자의 username이야. 이 툴을 사용하기 전에 이걸 요청해."),
				deckId: z.string().describe("카드 뭉치의 ID. 'list-decks' 툴을 통해서 deck ID를 얻을 수 있다.")
			},
			annotations: {
				readOnlyHint: true,
			},
			_meta: {
				ui: {
					resourceUri: WIDGET_URI,
				}
			}
		}, async ({username, deckId}) => {
			const deckkey = `user:${username}:deck:${deckId}`;

			const deck = await env.FLASHCARDS_KV.get<Deck>(deckkey, "json")

			if (!deck) {
				return {
					content: [{ text: "카드 뭉치를 찾을 수 없습니다..", type: "text" }],
					structuredContent: { decks: [] },
				}
			}

			return {
				content: [
					{
						type: "text",
						text: `${deck.description} 으로 공부 중인 ${deck.title} 열렸습니다. ${JSON.stringify(deck.cards)}`,
					}
				],
				structuredContent: { deck, username, deckId },
			}
		});

		// mark card (private)
		registerAppTool(server, "mark-card", {
			title: "Mark Card",
			description: "카드의 상태값을 바꾸는 툴이다.",
			inputSchema: {
				username: z.string(),
				deckId: z.string(),
				status: z.enum(['learning', 'mastered']),
				cardId: z.string(),
			},
			annotations: {
				readOnlyHint: false,
			},
			_meta: {
				ui: {
					visibility: ['app'],
				}
			},
		}, async ({username, deckId, cardId, status}) => {
			const deckkey = `user:${username}:deck:${deckId}`;

			const deck = await env.FLASHCARDS_KV.get<Deck>(deckkey, "json")

			if (!deck) {
				return {
					content: [{ text: "Error not found", type: "text" }],
					isError: true,
				}
			}

			const card = deck.cards.find((card) => card.id === cardId)

			if (card) {
				card.status = status;
			}

			await env.FLASHCARDS_KV.put(deckId, JSON.stringify(deck));

			return {
				content: [
					{
						type: "text",
						text: `${cardId} 카드는 ${status} 상태로 업데이트 되었습니다.`,
					}
				],
				structuredContent: { deck },
			}
		});

		// reset deck (private)
		registerAppTool(server, "reset-deck", {
			title: "Reset Deck",
			description: "카드 뭉치의 공부 진도를 지셋하는 툴이다.",
			inputSchema: {
				username: z.string(),
				deckId: z.string(),
			},
			annotations: {
				destructiveHint: true,
			},
			_meta: {
				ui: {
					visibility: ['app'],
				}
			},
		}, async ({username, deckId}) => {
			const deckkey = `user:${username}:deck:${deckId}`;

			const deck = await env.FLASHCARDS_KV.get<Deck>(deckkey, "json")

			if (!deck) {
				return {
					content: [{ text: "Error not found", type: "text" }],
					isError: true,
				}
			}
			
			for (const card of deck.cards) {
				card.status = "new"
			}

			await env.FLASHCARDS_KV.put(deckId, JSON.stringify(deck));

			return {
				content: [
					{
						type: "text",
						text: `카드 뭉치 공부 진도가 초기화되었습니다.`,
					}
				],
				structuredContent: { deck },
			}
		});

		// delete deck
		registerAppTool(server, "delete-deck", {
			title: "Delete Deck",
			description: "이 툴은 카드 뭉치를 삭제하는 툴이야. 만약 아직 username을 받지 못했다면 이 툴을 사용하기 전에 사용자에게 username을 물어봐. 공부할 카드 뭉치의 deck ID도 가지고 있어야 해.",
			inputSchema: {
				username: z.string().describe("사용자의 username이야. 이 툴을 사용하기 전에 이걸 요청해."),
				deckId: z.string().describe("삭제할 카드 뭉치의 ID. 'list-decks' 툴을 통해서 deck ID를 얻을 수 있다.")
			},
			annotations: {
				destructiveHint: true,
			},
			_meta: {},
		}, async ({username, deckId}) => {
			const deckkey = `user:${username}:deck:${deckId}`;

			const deck = await env.FLASHCARDS_KV.get<Deck>(deckkey, "json")

			if (!deck) {
				return {
					content: [{ text: "카드 뭉치를 찾을 수 없습니다..", type: "text" }],
				}
			}
			await env.FLASHCARDS_KV.delete(deckkey);

			return {
				content: [
					{
						type: "text",
						text: `선택한 카드 뭉치를 삭제하였습니다.`,
					}
				],
			}
		});

		const handler = createMcpHandler(server);

		return handler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
